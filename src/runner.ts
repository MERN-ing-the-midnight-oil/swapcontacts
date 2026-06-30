import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import { JOBS } from './jobs';
import { Job, RunOptions, SwapEvent } from './types';
import { runDiscoveryJob } from './search';
import { enrichEvent } from './enrich';
import { shouldRunDiscoveryJob } from './season';
import {
  loadEvents,
  saveEvent,
  loadContacts,
  getOutputPaths,
} from './storage';
import {
  logInfo,
  logSuccess,
  logError,
  logRunning,
  logDone,
  startSpinner,
  stopSpinner,
} from './logger';

let shuttingDown = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupGracefulShutdown(onShutdown: () => Promise<void>): void {
  process.on('SIGINT', async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n');
    logInfo('Interrupt received — finishing current task then stopping...');
    await onShutdown();
    process.exit(0);
  });
}

async function loadJobState(outputDir: string): Promise<Map<string, Job>> {
  const statePath = path.join(outputDir, 'jobs-state.json');
  const jobMap = new Map<string, Job>();

  for (const job of JOBS) {
    jobMap.set(job.id, { ...job });
  }

  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const saved = JSON.parse(content) as Job[];
    for (const savedJob of saved) {
      const existing = jobMap.get(savedJob.id);
      if (existing) {
        jobMap.set(savedJob.id, { ...existing, ...savedJob });
      }
    }
  } catch {
    // No saved state yet
  }

  return jobMap;
}

async function saveJobState(
  jobs: Map<string, Job>,
  outputDir: string
): Promise<void> {
  const statePath = path.join(outputDir, 'jobs-state.json');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    statePath,
    JSON.stringify(Array.from(jobs.values()), null, 2),
    'utf-8'
  );
}

function selectJobs(
  allJobs: Map<string, Job>,
  jobIds?: string[],
  regionalOnly?: boolean,
  nationwideOnly?: boolean
): Job[] {
  let jobs = Array.from(allJobs.values());
  if (regionalOnly) {
    jobs = jobs.filter((j) => j.id.startsWith('sj-') || j.id.startsWith('reg-'));
  } else if (nationwideOnly) {
    jobs = jobs.filter((j) => !j.id.startsWith('sj-') && !j.id.startsWith('reg-'));
  }
  if (jobIds && jobIds.length > 0) {
    jobs = jobs.filter((j) => jobIds.includes(j.id));
  }
  return jobs;
}

export async function runDiscover(options: RunOptions): Promise<void> {
  const jobState = await loadJobState(options.outputDir);
  const existingEvents = await loadEvents(options.outputDir);
  const jobsToRun = selectJobs(
    jobState,
    options.jobs,
    options.regionalOnly,
    options.nationwideOnly
  ).filter((j) =>
    shouldRunDiscoveryJob(j, {
      allowSeasonalRefresh: options.allowSeasonalRefresh,
    })
  );

  if (jobsToRun.length === 0) {
    logInfo(
      options.allowSeasonalRefresh
        ? 'All discovery jobs already completed (or outside seasonal refresh window).'
        : 'All discovery jobs already completed. Use --seasonal-refresh during a refresh window, or omit --no-seasonal-refresh.'
    );
    return;
  }

  setupGracefulShutdown(async () => {
    await saveJobState(jobState, options.outputDir);
  });

  for (const job of jobsToRun) {
    if (shuttingDown) break;

    job.status = 'running';
    await saveJobState(jobState, options.outputDir);

    logRunning(`▶ Running ${job.id}: ${job.name}`);
    const spinner = startSpinner(`Searching for ${job.type} swap events...`);

    try {
      const discovered = await runDiscoveryJob(
        job,
        options.outputDir,
        options.discoveryModel
      );
      let newCount = 0;

      for (const event of discovered) {
        const saved = await saveEvent(event, options.outputDir, existingEvents);
        if (saved) newCount++;
        existingEvents.set(event.id, event);
      }

      job.status = 'done';
      job.foundCount = discovered.length;
      job.error = undefined;
      job.completedAt = new Date().toISOString();
      await saveJobState(jobState, options.outputDir);

      stopSpinner(true, `${job.id} done — ${discovered.length} found (${newCount} new)`);
      logDone(`  ✓ ${job.id} done — ${discovered.length} found`);
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : String(error);
      await saveJobState(jobState, options.outputDir);
      stopSpinner(false, `${job.id} failed`);
      logError(`  ✗ ${job.id} error: ${job.error}`);
    }

    if (shuttingDown) break;
    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }
}

export async function runEnrich(options: RunOptions): Promise<void> {
  const events = await loadEvents(options.outputDir);
  const contacts = await loadContacts(options.outputDir);

  let unenriched = Array.from(events.values()).filter(
    (e) => !e.enriched && !contacts.has(e.id)
  );

  if (options.enrichLimit && options.enrichLimit > 0) {
    unenriched = unenriched.slice(0, options.enrichLimit);
  }

  if (unenriched.length === 0) {
    logInfo('No unenriched events remaining.');
    return;
  }

  setupGracefulShutdown(async () => {
    // State is saved incrementally per event
  });

  const concurrency = Math.min(Math.max(options.concurrency, 1), 2);
  const limit = pLimit(concurrency);

  logInfo(`Enriching ${unenriched.length} event(s) (concurrency: ${concurrency})...`);

  const tasks = unenriched.map((event, index) =>
    limit(async () => {
      if (shuttingDown) return;

      logRunning(`▶ [${index + 1}/${unenriched.length}] ${event.name}`);
      const spinner = startSpinner(`Searching contacts for ${event.organizer || event.name}...`);

      try {
        await enrichEvent(event, options.outputDir, options.enrichmentModel);
        stopSpinner(true, `Enriched ${event.name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        stopSpinner(false, `Failed: ${event.name}`);
        logError(`  ✗ ${event.name}: ${msg}`);
      }

      if (options.delayMs > 0 && !shuttingDown) {
        await sleep(options.delayMs);
      }
    })
  );

  await Promise.all(tasks);
  logSuccess(`Enrichment complete.`);
}

export async function runFullPipeline(options: RunOptions): Promise<void> {
  if (!options.enrichOnly) {
    await runDiscover(options);
  }
  if (!options.discoverOnly && !shuttingDown) {
    await runEnrich(options);
  }
}

export async function printStatus(outputDir: string): Promise<void> {
  const jobState = await loadJobState(outputDir);
  const events = await loadEvents(outputDir);
  const contacts = await loadContacts(outputDir);
  const paths = getOutputPaths(outputDir);

  const nationwide = JOBS.filter((j) => !j.id.startsWith('sj-') && !j.id.startsWith('reg-'));
  const regional = JOBS.filter((j) => j.id.startsWith('sj-') || j.id.startsWith('reg-'));

  function jobSummary(jobs: Job[]): { done: number; pending: number; error: number } {
    let done = 0;
    let pending = 0;
    let error = 0;
    for (const job of jobs) {
      const state = jobState.get(job.id) ?? job;
      if (state.status === 'done') done++;
      else if (state.status === 'error') error++;
      else pending++;
    }
    return { done, pending, error };
  }

  const nw = jobSummary(nationwide);
  const reg = jobSummary(regional);

  console.log('\nSwap Event Finder — Status');
  console.log('──────────────────────────────────────');
  console.log('Pass 1 — Discovery Jobs');
  console.log(
    `  Nationwide:  ${nw.done}/${nationwide.length} done` +
      (nw.error ? `, ${nw.error} error` : '') +
      (nw.pending ? `, ${nw.pending} pending` : '')
  );
  console.log(
    `  Superjobs:   ${reg.done}/${regional.length} done` +
      (reg.error ? `, ${reg.error} error` : '') +
      (reg.pending ? `, ${reg.pending} pending` : '')
  );

  if (reg.pending > 0 && reg.pending <= 20) {
    console.log('\n  Pending superjobs:');
    for (const job of regional) {
      const state = jobState.get(job.id) ?? job;
      if (state.status !== 'done' && state.status !== 'error') {
        console.log(`    ○ ${job.id}`);
      }
    }
  } else if (reg.error > 0 && reg.error <= 10) {
    console.log('\n  Failed superjobs:');
    for (const job of regional) {
      const state = jobState.get(job.id) ?? job;
      if (state.status === 'error') {
        console.log(`    ✗ ${job.id}`);
      }
    }
  }

  for (const job of nationwide) {
    const state = jobState.get(job.id) ?? job;
    const icon =
      state.status === 'done'
        ? '✓'
        : state.status === 'error'
          ? '✗'
          : state.status === 'running'
            ? '…'
            : '○';
    const count =
      state.status === 'done'
        ? `${String(state.foundCount).padStart(3)} found`
        : state.status.padEnd(7);
    console.log(`  ${icon} ${state.id.padEnd(16)} ${count}`);
  }

  const enrichedCount = Array.from(events.values()).filter((e) => e.enriched).length;
  const withContact = Array.from(contacts.values()).filter((c) => c.contactFound).length;
  const remaining = Array.from(events.values()).filter(
    (e) => !e.enriched && !contacts.has(e.id)
  ).length;

  console.log('');
  console.log('Pass 2 — Enrichment');
  console.log(`  Events discovered:    ${events.size}`);
  console.log(`  Enriched:             ${enrichedCount}`);
  console.log(`  With contact info:    ${withContact}`);
  console.log(`  Remaining:            ${remaining}`);
  console.log('');
  console.log('Output files:');
  console.log(`  ${paths.events}`);
  console.log(`  ${paths.contacts}`);
  console.log('');
}

export async function printExport(outputDir: string): Promise<void> {
  const events = await loadEvents(outputDir);
  const contacts = await loadContacts(outputDir);
  const paths = getOutputPaths(outputDir);

  const byType = new Map<string, number>();
  for (const event of events.values()) {
    byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
  }

  console.log('\nSwap Event Finder — Export Summary');
  console.log('──────────────────────────────────────');
  console.log(`Total events:          ${events.size}`);
  console.log(`Total contacts:        ${contacts.size}`);
  console.log(
    `With contact info:     ${Array.from(contacts.values()).filter((c) => c.contactFound).length}`
  );
  console.log('');
  console.log('Events by type:');
  for (const [type, count] of byType) {
    console.log(`  ${type.padEnd(10)} ${count}`);
  }
  console.log('');
  console.log('Output files:');
  console.log(`  ${paths.events}`);
  console.log(`  ${paths.contacts}`);
  console.log(`  ${paths.jobsState}`);
  console.log('');
}

export function getUnenrichedEvents(outputDir: string): Promise<SwapEvent[]> {
  return loadEvents(outputDir).then((events) =>
    Array.from(events.values()).filter((e) => !e.enriched)
  );
}
