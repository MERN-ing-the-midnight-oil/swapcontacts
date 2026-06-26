import fs from 'fs/promises';
import path from 'path';
import { SUPERJOBS } from './superjobs';
import { getJobIdsForSuperjob } from './superjob-jobs';
import { runDiscover, runEnrich } from './runner';
import { loadContacts, loadEvents } from './storage';
import {
  resolveDiscoveryModel,
  resolveEnrichmentModel,
} from './models';
import { getSuperjobOutputDir, newRunId, saveCompletedRun } from './superjob-runs';
import { RunOptions } from './types';

export { getSuperjobOutputDir } from './superjob-runs';

export function findSuperjob(superjobId: string) {
  return SUPERJOBS.find((sj) => sj.id === superjobId);
}

export interface SuperjobRunConfig {
  discoveryModel?: string;
  enrichmentModel?: string;
  startedAt?: string;
  logs?: string[];
}

export async function runSuperjobPipeline(
  superjobId: string,
  repoRoot: string,
  onProgress?: (message: string) => void,
  models?: SuperjobRunConfig
): Promise<{ eventCount: number; contactCount: number; withContact: number; runId: string }> {
  const sj = findSuperjob(superjobId);
  if (!sj) {
    throw new Error(`Unknown superjob: ${superjobId}`);
  }

  const jobIds = getJobIdsForSuperjob(superjobId);
  if (jobIds.length === 0) {
    throw new Error(`No discovery jobs for superjob: ${superjobId}`);
  }

  const outputDir = getSuperjobOutputDir(repoRoot, superjobId);
  await fs.mkdir(outputDir, { recursive: true });

  const discoveryModel = resolveDiscoveryModel(models?.discoveryModel);
  const enrichmentModel = resolveEnrichmentModel(models?.enrichmentModel);
  const startedAt = models?.startedAt || new Date().toISOString();
  const runId = newRunId();

  const options: RunOptions = {
    outputDir,
    delayMs: 2000,
    concurrency: 1,
    enrichOnly: false,
    discoverOnly: false,
    regionalOnly: false,
    nationwideOnly: false,
    allowSeasonalRefresh: false,
    jobs: jobIds,
    discoveryModel,
    enrichmentModel,
  };

  onProgress?.(`Discovering swap events in ${sj.label} (${jobIds.length} searches)…`);
  await runDiscover(options);

  onProgress?.('Finding contact info for new organizations…');
  await runEnrich(options);

  const events = await loadEvents(outputDir);
  const contacts = await loadContacts(outputDir);
  const withContact = Array.from(contacts.values()).filter((c) => c.contactFound).length;

  const meta = {
    superjobId,
    label: sj.label,
    queryPlace: sj.queryPlace,
    completedAt: new Date().toISOString(),
    eventCount: events.size,
    contactCount: contacts.size,
    withContact,
    discoveryModel,
    enrichmentModel,
    runId,
  };

  await fs.writeFile(
    path.join(outputDir, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  );

  await saveCompletedRun(repoRoot, {
    runId,
    superjobId,
    label: sj.label,
    queryPlace: sj.queryPlace,
    approxPopM: sj.approxPopM,
    stateCodes: sj.stateCodes,
    startedAt,
    completedAt: meta.completedAt,
    discoveryModel,
    enrichmentModel,
    discoveryJobIds: jobIds,
    eventCount: events.size,
    contactCount: contacts.size,
    withContact,
    logs: models?.logs,
  });

  // Copy into docs for static fallback after sync
  const docsDir = path.join(repoRoot, 'docs', 'superjobs', superjobId);
  await fs.mkdir(docsDir, { recursive: true });
  const contactsPath = path.join(outputDir, 'contacts.csv');
  try {
    await fs.copyFile(contactsPath, path.join(docsDir, 'contacts.csv'));
    await fs.copyFile(
      path.join(outputDir, 'meta.json'),
      path.join(docsDir, 'meta.json')
    );
  } catch {
    // contacts.csv may be empty if nothing found
  }

  onProgress?.(`Done — ${contacts.size} contacts (${withContact} with email/phone/Facebook).`);

  return {
    eventCount: events.size,
    contactCount: contacts.size,
    withContact,
    runId,
  };
}
