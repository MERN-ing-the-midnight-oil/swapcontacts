import { JobSeason } from './types';

/** True during the pre-season refresh window for this job type. */
export function isInSeasonRefreshWindow(
  season: JobSeason,
  date = new Date()
): boolean {
  const month = date.getMonth() + 1;
  switch (season) {
    case 'bike-spring':
      return month >= 1 && month <= 4;
    case 'ski-fall':
      return month >= 7 && month <= 10;
    case 'all-season':
      return (month >= 2 && month <= 3) || (month >= 8 && month <= 9);
  }
}

/** Start of the current refresh window (jobs completed before this are re-eligible). */
export function currentWindowStart(season: JobSeason, date = new Date()): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  switch (season) {
    case 'bike-spring':
      return new Date(year, 0, 1);
    case 'ski-fall':
      return new Date(year, 6, 1);
    case 'all-season':
      if (month >= 8) return new Date(year, 7, 1);
      return new Date(year, 1, 1);
  }
}

export function seasonLabel(season: JobSeason): string {
  switch (season) {
    case 'bike-spring':
      return 'Jan–Apr (pre bike season)';
    case 'ski-fall':
      return 'Jul–Oct (pre ski season)';
    case 'all-season':
      return 'Feb–Mar & Aug–Sep';
  }
}

/** Whether a completed job should run again this season. */
export function shouldRerunCompletedJob(
  season: JobSeason | undefined,
  completedAt: string | undefined,
  date = new Date()
): boolean {
  if (!season) return false;
  if (!isInSeasonRefreshWindow(season, date)) return false;
  if (!completedAt) return true;
  return new Date(completedAt) < currentWindowStart(season, date);
}

export function shouldRunDiscoveryJob(
  job: { status: string; season?: JobSeason; completedAt?: string },
  options: { allowSeasonalRefresh: boolean },
  date = new Date()
): boolean {
  if (job.status === 'error') return true;
  if (job.status !== 'done') return true;
  if (!options.allowSeasonalRefresh) return false;
  return shouldRerunCompletedJob(job.season, job.completedAt, date);
}
