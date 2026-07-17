#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { RunOptions } from './types';
import {
  runDiscover,
  runEnrich,
  runFullPipeline,
  runBackfillValedictions,
  printStatus,
  printExport,
} from './runner';

dotenv.config();

const program = new Command();

program
  .name('swap-finder')
  .description(
    'Find non-profit gear swap events across the USA and build a contact database'
  )
  .version('1.0.0');

function buildOptions(cmd: Command): RunOptions {
  const globalOpts = program.opts<{
    outputDir: string;
    delay: number;
    concurrency: number;
    noSeasonalRefresh?: boolean;
  }>();
  const opts = cmd.opts<{
    jobs?: string;
    limit?: number;
    regionalOnly?: boolean;
    nationwideOnly?: boolean;
  }>();

  return {
    outputDir: path.resolve(globalOpts.outputDir),
    delayMs: globalOpts.delay,
    concurrency: Math.min(Math.max(globalOpts.concurrency, 1), 2),
    enrichOnly: false,
    discoverOnly: false,
    regionalOnly: !!opts.regionalOnly,
    nationwideOnly: !!opts.nationwideOnly,
    allowSeasonalRefresh: !globalOpts.noSeasonalRefresh,
    jobs: opts.jobs ? opts.jobs.split(',').map((j) => j.trim()) : undefined,
    enrichLimit: opts.limit,
  };
}

program
  .option('--output-dir <path>', 'Where to write CSVs', './output')
  .option('--delay <ms>', 'Delay between API calls in ms', (v) => parseInt(v, 10), 2000)
  .option(
    '--concurrency <n>',
    'Parallel API calls (max 2)',
    (v) => parseInt(v, 10),
    1
  )
  .option(
    '--no-seasonal-refresh',
    'Skip re-running completed jobs during their seasonal refresh window'
  );

program
  .command('discover')
  .description('Run Pass 1 discovery jobs')
  .option('--jobs <ids>', 'Comma-separated job IDs to run (e.g. eb-bike,reg-gear-co)')
  .option('--regional-only', 'Run only state-level regional jobs')
  .option('--nationwide-only', 'Run only original nationwide jobs')
  .action(async (cmdOpts, cmd) => {
    const options = buildOptions(cmd);
    options.discoverOnly = true;
    try {
      await runDiscover(options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('enrich')
  .description('Run Pass 2 enrichment on unenriched events')
  .option('--limit <n>', 'Enrich only the first N unenriched events', (v) => parseInt(v, 10))
  .action(async (cmdOpts, cmd) => {
    const options = buildOptions(cmd);
    options.enrichOnly = true;
    try {
      await runEnrich(options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run full pipeline (discover then enrich)')
  .option('--jobs <ids>', 'Comma-separated job IDs for discovery phase')
  .option('--regional-only', 'Run only state-level regional jobs')
  .option('--nationwide-only', 'Run only original nationwide jobs')
  .option('--limit <n>', 'Enrich only the first N unenriched events', (v) => parseInt(v, 10))
  .action(async (cmdOpts, cmd) => {
    const options = buildOptions(cmd);
    try {
      await runFullPipeline(options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show job status and stats')
  .action(async () => {
    const outputDir = path.resolve(program.opts<{ outputDir: string }>().outputDir);
    await printStatus(outputDir);
  });

program
  .command('export')
  .description('Print summary stats and file paths')
  .action(async () => {
    const outputDir = path.resolve(program.opts<{ outputDir: string }>().outputDir);
    await printExport(outputDir);
  });

program
  .command('backfill-valedictions')
  .description('Generate tailored sign-off phrases for contacts missing valedictions')
  .option('--limit <n>', 'Backfill only the first N contacts', (v) => parseInt(v, 10))
  .action(async (cmdOpts, cmd) => {
    const options = buildOptions(cmd);
    try {
      await runBackfillValedictions(options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
