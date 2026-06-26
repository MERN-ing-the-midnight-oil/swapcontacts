#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import {
  findSuperjob,
  runSuperjobPipeline,
  SuperjobRunConfig,
} from './superjob-runner';
import {
  CLAUDE_MODELS,
  DEFAULT_DISCOVERY_MODEL,
  DEFAULT_ENRICHMENT_MODEL,
  formatModelWithPricing,
  resolveDiscoveryModel,
  resolveEnrichmentModel,
} from './models';
import {
  formatRunIdForDisplay,
  getCompletedRun,
  getSuperjobOutputDir,
  listCompletedRuns,
} from './superjob-runs';
import { estimateSuperjobRunCost } from './cost-estimate';
import { SUPERJOBS } from './superjobs';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3333', 10);
const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.join(REPO_ROOT, 'docs');

interface RunState {
  status: 'running' | 'done' | 'error';
  message: string;
  logs: string[];
  startedAt: string;
  finishedAt?: string;
  contactCount?: number;
  error?: string;
  discoveryModel?: string;
  enrichmentModel?: string;
}

const activeRuns = new Map<string, RunState>();

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(body);
}

async function readSuperjobMeta(superjobId: string): Promise<Record<string, unknown> | null> {
  for (const base of [
    getSuperjobOutputDir(REPO_ROOT, superjobId),
    path.join(DOCS_ROOT, 'superjobs', superjobId),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, 'meta.json'), 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // try next path
    }
  }
  return null;
}

async function superjobHasContacts(superjobId: string): Promise<boolean> {
  for (const base of [
    getSuperjobOutputDir(REPO_ROOT, superjobId),
    path.join(DOCS_ROOT, 'superjobs', superjobId),
  ]) {
    try {
      await fs.access(path.join(base, 'contacts.csv'));
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

async function listSuperjobsPayload() {
  const items = await Promise.all(
    SUPERJOBS.map(async (sj) => {
      const meta = await readSuperjobMeta(sj.id);
      const run = activeRuns.get(sj.id);
      const completedRuns = await listCompletedRuns(REPO_ROOT, DOCS_ROOT, sj.id);
      return {
        id: sj.id,
        label: sj.label,
        queryPlace: sj.queryPlace,
        approxPopM: sj.approxPopM,
        stateCodes: sj.stateCodes,
        hasResults: await superjobHasContacts(sj.id),
        meta,
        run: run ?? null,
        completedRuns,
      };
    })
  );
  return items;
}

async function resolveContactsPath(superjobId: string): Promise<string | null> {
  for (const base of [
    getSuperjobOutputDir(REPO_ROOT, superjobId),
    path.join(DOCS_ROOT, 'superjobs', superjobId),
  ]) {
    const p = path.join(base, 'contacts.csv');
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

async function serveStatic(urlPath: string, res: http.ServerResponse): Promise<boolean> {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel.includes('..')) return false;

  const filePath = path.join(DOCS_ROOT, rel);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.csv': 'text/csv',
      '.json': 'application/json',
    };
    const body = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function startSuperjobRun(
  superjobId: string,
  models: SuperjobRunConfig
): Promise<void> {
  const discoveryModel = resolveDiscoveryModel(models.discoveryModel);
  const enrichmentModel = resolveEnrichmentModel(models.enrichmentModel);

  const state: RunState = {
    status: 'running',
    message: 'Starting…',
    logs: [],
    startedAt: new Date().toISOString(),
    discoveryModel,
    enrichmentModel,
  };
  activeRuns.set(superjobId, state);

  const log = (message: string) => {
    state.message = message;
    state.logs.push(message);
  };

  try {
    const result = await runSuperjobPipeline(superjobId, REPO_ROOT, log, {
      discoveryModel,
      enrichmentModel,
      startedAt: state.startedAt,
      logs: state.logs,
    });
    state.status = 'done';
    state.contactCount = result.contactCount;
    state.finishedAt = new Date().toISOString();
  } catch (error) {
    state.status = 'error';
    state.error = error instanceof Error ? error.message : String(error);
    state.message = state.error;
    state.finishedAt = new Date().toISOString();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    });
    return;
  }

  if (pathname === '/api/models' && req.method === 'GET') {
    sendJson(res, 200, {
      models: CLAUDE_MODELS.map((m) => ({
        ...m,
        displayLabel: formatModelWithPricing(m.id),
      })),
      defaults: {
        discovery: DEFAULT_DISCOVERY_MODEL,
        enrichment: DEFAULT_ENRICHMENT_MODEL,
      },
    });
    return;
  }

  if (pathname === '/api/superjobs' && req.method === 'GET') {
    sendJson(res, 200, { superjobs: await listSuperjobsPayload() });
    return;
  }

  const runMatch = pathname.match(/^\/api\/superjobs\/([^/]+)\/run$/);
  if (runMatch && req.method === 'POST') {
    const superjobId = decodeURIComponent(runMatch[1]);
    if (!findSuperjob(superjobId)) {
      sendJson(res, 404, { error: 'Unknown superjob' });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      sendJson(res, 503, { error: 'ANTHROPIC_API_KEY is not set in .env' });
      return;
    }
    const existing = activeRuns.get(superjobId);
    if (existing?.status === 'running') {
      sendJson(res, 409, { error: 'Run already in progress', run: existing });
      return;
    }
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const discoveryModel = resolveDiscoveryModel(
      typeof body.discoveryModel === 'string' ? body.discoveryModel : undefined
    );
    const enrichmentModel = resolveEnrichmentModel(
      typeof body.enrichmentModel === 'string' ? body.enrichmentModel : undefined
    );
    void startSuperjobRun(superjobId, { discoveryModel, enrichmentModel });
    sendJson(res, 202, {
      started: true,
      superjobId,
      discoveryModel,
      enrichmentModel,
      run: activeRuns.get(superjobId),
    });
    return;
  }

  const statusMatch = pathname.match(/^\/api\/superjobs\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'GET') {
    const superjobId = decodeURIComponent(statusMatch[1]);
    const run = activeRuns.get(superjobId);
    const meta = await readSuperjobMeta(superjobId);
    sendJson(res, 200, {
      superjobId,
      run: run ?? null,
      meta,
      hasResults: await superjobHasContacts(superjobId),
    });
    return;
  }

  const runDetailMatch = pathname.match(
    /^\/api\/superjobs\/([^/]+)\/runs\/([^/]+)$/
  );
  if (runDetailMatch && req.method === 'GET') {
    const superjobId = decodeURIComponent(runDetailMatch[1]);
    const runId = decodeURIComponent(runDetailMatch[2]);
    if (!findSuperjob(superjobId)) {
      sendJson(res, 404, { error: 'Unknown superjob' });
      return;
    }
    const record = await getCompletedRun(REPO_ROOT, DOCS_ROOT, superjobId, runId);
    if (!record) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    const costEstimate = estimateSuperjobRunCost(record);
    sendJson(res, 200, {
      run: {
        ...record,
        discoveryModelLabel: formatModelWithPricing(record.discoveryModel),
        enrichmentModelLabel: formatModelWithPricing(record.enrichmentModel),
        completedAtDisplay: formatRunIdForDisplay(record.completedAt),
        startedAtDisplay: formatRunIdForDisplay(record.startedAt),
        outreachUrl: `/#/outreach/${superjobId}`,
        costEstimate,
      },
    });
    return;
  }

  const contactsMatch = pathname.match(/^\/api\/superjobs\/([^/]+)\/contacts\.csv$/);
  if (contactsMatch && req.method === 'GET') {
    const superjobId = decodeURIComponent(contactsMatch[1]);
    const filePath = await resolveContactsPath(superjobId);
    if (!filePath) {
      sendText(res, 404, 'No contacts yet — run this superjob first.');
      return;
    }
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
    return;
  }

  if (pathname === '/api/messages' && req.method === 'POST') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      sendJson(res, 503, { error: 'ANTHROPIC_API_KEY is not set in .env' });
      return;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      const data = (await upstream.json()) as Record<string, unknown>;
      sendJson(res, upstream.status, data);
    } catch (error) {
      sendJson(res, 502, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (await serveStatic(pathname, res)) {
    return;
  }

  sendText(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`Swap outreach + API server → http://localhost:${PORT}`);
  console.log(`  Discover UI: http://localhost:${PORT}/#/discover`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  Warning: ANTHROPIC_API_KEY not set — superjob runs will fail.');
  }
});
