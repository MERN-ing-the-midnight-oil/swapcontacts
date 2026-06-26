import { REGIONAL_JOBS } from './jobs-regional';

/** Discovery job IDs belonging to one superjob (e.g. sj-gear-wa-ak → wa-ak). */
export function getJobIdsForSuperjob(superjobId: string): string[] {
  const suffix = `-${superjobId}`;
  return REGIONAL_JOBS.filter((j) => j.id.endsWith(suffix)).map((j) => j.id);
}
