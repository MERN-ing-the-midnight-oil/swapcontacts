import fs from 'fs/promises';
import path from 'path';
import { getJobIdsForSuperjob } from './superjob-jobs';

export function getSuperjobOutputDir(repoRoot: string, superjobId: string): string {
  return path.join(repoRoot, 'output', 'superjobs', superjobId);
}

export interface SuperjobRunSummary {
  runId: string;
  completedAt: string;
  contactCount: number;
  eventCount: number;
  withContact: number;
  discoveryModel: string;
  enrichmentModel: string;
}

export interface SuperjobRunRecord extends SuperjobRunSummary {
  superjobId: string;
  label: string;
  queryPlace: string;
  approxPopM: number;
  stateCodes: string[];
  startedAt: string;
  discoveryJobIds: string[];
  logs?: string[];
}

function runsDir(superjobDir: string): string {
  return path.join(superjobDir, 'runs');
}

function runsIndexPath(superjobDir: string): string {
  return path.join(superjobDir, 'runs-index.json');
}

function runRecordPath(superjobDir: string, runId: string): string {
  return path.join(runsDir(superjobDir), `${runId}.json`);
}

function runContactsPath(superjobDir: string, runId: string): string {
  return path.join(runsDir(superjobDir), runId, 'contacts.csv');
}

export function newRunId(): string {
  return new Date().toISOString();
}

async function readRunsIndex(superjobDir: string): Promise<SuperjobRunSummary[]> {
  try {
    const raw = await fs.readFile(runsIndexPath(superjobDir), 'utf-8');
    const parsed = JSON.parse(raw) as SuperjobRunSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRunsIndex(
  superjobDir: string,
  index: SuperjobRunSummary[]
): Promise<void> {
  await fs.mkdir(runsDir(superjobDir), { recursive: true });
  await fs.writeFile(runsIndexPath(superjobDir), JSON.stringify(index, null, 2), 'utf-8');
}

/** Import legacy meta.json as a completed run when no run history exists yet. */
async function migrateLegacyMeta(
  superjobDir: string,
  superjobId: string
): Promise<void> {
  const existing = await readRunsIndex(superjobDir);
  if (existing.length > 0) return;

  try {
    const raw = await fs.readFile(path.join(superjobDir, 'meta.json'), 'utf-8');
    const meta = JSON.parse(raw) as Record<string, unknown>;
    const completedAt =
      typeof meta.completedAt === 'string' ? meta.completedAt : null;
    if (!completedAt) return;

    const runId = completedAt;
    const record: SuperjobRunRecord = {
      runId,
      superjobId,
      label: String(meta.label || superjobId),
      queryPlace: String(meta.queryPlace || ''),
      approxPopM: Number(meta.approxPopM) || 0,
      stateCodes: Array.isArray(meta.stateCodes)
        ? (meta.stateCodes as string[])
        : [],
      startedAt: completedAt,
      completedAt,
      discoveryModel: 'claude-opus-4-5',
      enrichmentModel: 'claude-sonnet-4-5',
      discoveryJobIds: getJobIdsForSuperjob(superjobId),
      eventCount: Number(meta.eventCount) || 0,
      contactCount: Number(meta.contactCount) || 0,
      withContact: Number(meta.withContact) || 0,
    };

    await fs.mkdir(runsDir(superjobDir), { recursive: true });
    await fs.writeFile(
      runRecordPath(superjobDir, runId),
      JSON.stringify(record, null, 2),
      'utf-8'
    );

    const contactsSrc = path.join(superjobDir, 'contacts.csv');
    const contactsDest = runContactsPath(superjobDir, runId);
    try {
      await fs.mkdir(path.dirname(contactsDest), { recursive: true });
      await fs.copyFile(contactsSrc, contactsDest);
    } catch {
      // no contacts snapshot available
    }

    await writeRunsIndex(superjobDir, [
      {
        runId: record.runId,
        completedAt: record.completedAt,
        contactCount: record.contactCount,
        eventCount: record.eventCount,
        withContact: record.withContact,
        discoveryModel: record.discoveryModel,
        enrichmentModel: record.enrichmentModel,
      },
    ]);
  } catch {
    // no legacy meta
  }
}

export async function saveCompletedRun(
  repoRoot: string,
  record: SuperjobRunRecord
): Promise<void> {
  const superjobDir = getSuperjobOutputDir(repoRoot, record.superjobId);
  await fs.mkdir(runsDir(superjobDir), { recursive: true });

  await fs.writeFile(
    runRecordPath(superjobDir, record.runId),
    JSON.stringify(record, null, 2),
    'utf-8'
  );

  const contactsSrc = path.join(superjobDir, 'contacts.csv');
  const contactsDest = runContactsPath(superjobDir, record.runId);
  try {
    await fs.mkdir(path.dirname(contactsDest), { recursive: true });
    await fs.copyFile(contactsSrc, contactsDest);
  } catch {
    // contacts may be missing if run found nothing
  }

  const index = await readRunsIndex(superjobDir);
  const summary: SuperjobRunSummary = {
    runId: record.runId,
    completedAt: record.completedAt,
    contactCount: record.contactCount,
    eventCount: record.eventCount,
    withContact: record.withContact,
    discoveryModel: record.discoveryModel,
    enrichmentModel: record.enrichmentModel,
  };
  const withoutDup = index.filter((r) => r.runId !== record.runId);
  withoutDup.unshift(summary);
  await writeRunsIndex(superjobDir, withoutDup);

  // Sync run history into docs for static fallback
  const docsDir = path.join(repoRoot, 'docs', 'superjobs', record.superjobId);
  await fs.mkdir(path.join(docsDir, 'runs'), { recursive: true });
  await fs.writeFile(
    path.join(docsDir, 'runs', `${record.runId}.json`),
    JSON.stringify(record, null, 2),
    'utf-8'
  );
  await fs.writeFile(
    path.join(docsDir, 'runs-index.json'),
    JSON.stringify(withoutDup, null, 2),
    'utf-8'
  );
  try {
    await fs.mkdir(path.join(docsDir, 'runs', record.runId), { recursive: true });
    await fs.copyFile(
      contactsDest,
      path.join(docsDir, 'runs', record.runId, 'contacts.csv')
    );
  } catch {
    // optional snapshot
  }
}

async function resolveSuperjobDir(
  repoRoot: string,
  docsRoot: string,
  superjobId: string
): Promise<string | null> {
  for (const base of [
    getSuperjobOutputDir(repoRoot, superjobId),
    path.join(docsRoot, 'superjobs', superjobId),
  ]) {
    try {
      await fs.access(base);
      return base;
    } catch {
      // try next
    }
  }
  return null;
}

export async function listCompletedRuns(
  repoRoot: string,
  docsRoot: string,
  superjobId: string
): Promise<SuperjobRunSummary[]> {
  const primaryDir = getSuperjobOutputDir(repoRoot, superjobId);
  try {
    await fs.mkdir(primaryDir, { recursive: true });
    await migrateLegacyMeta(primaryDir, superjobId);
    const index = await readRunsIndex(primaryDir);
    if (index.length > 0) {
      return index.sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );
    }
  } catch {
    // fall through
  }

  const fallbackDir = await resolveSuperjobDir(repoRoot, docsRoot, superjobId);
  if (!fallbackDir) return [];
  await migrateLegacyMeta(fallbackDir, superjobId);
  const index = await readRunsIndex(fallbackDir);
  return index.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}

export async function getCompletedRun(
  repoRoot: string,
  docsRoot: string,
  superjobId: string,
  runId: string
): Promise<SuperjobRunRecord | null> {
  for (const base of [
    getSuperjobOutputDir(repoRoot, superjobId),
    path.join(docsRoot, 'superjobs', superjobId),
  ]) {
    try {
      const raw = await fs.readFile(runRecordPath(base, runId), 'utf-8');
      return JSON.parse(raw) as SuperjobRunRecord;
    } catch {
      // try docs/runs path
      try {
        const raw = await fs.readFile(
          path.join(base, 'runs', `${runId}.json`),
          'utf-8'
        );
        return JSON.parse(raw) as SuperjobRunRecord;
      } catch {
        // continue
      }
    }
  }
  return null;
}

export function formatRunIdForDisplay(runId: string): string {
  const d = new Date(runId);
  if (Number.isNaN(d.getTime())) return runId;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
