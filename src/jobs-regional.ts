import { Job, JobSeason } from './types';
import {
  PLATFORM_PASS_MIN_POP_M,
  SUPERJOBS,
  Superjob,
  superjobTouchesState,
} from './superjobs';
import {
  HOCKEY_STATE_CODES,
  NORDIC_SKI_STATE_CODES,
  SKI_STATE_CODES,
} from './states';

interface JobOpts {
  season?: JobSeason;
  source?: Job['source'];
}

function makeJob(
  id: string,
  name: string,
  type: Job['type'],
  searchQuery: string,
  opts: JobOpts = {}
): Job {
  return {
    id,
    name,
    description: name,
    type,
    source: opts.source ?? 'Web',
    searchQuery,
    status: 'pending',
    foundCount: 0,
    season: opts.season,
  };
}

function gearSwapQuery(place: string): string {
  return (
    `Search the web for organizations and events advertising a "gear swap" in ${place}. ` +
    `Include any community, club, school, or nonprofit gear swap — outdoor, sports, golf, ` +
    `mountaineering, ski/bike equipment, YMCA, scouts, etc. ` +
    `Anyone advertising a gear swap is likely a community pop-up, not a retail store.`
  );
}

function bikeSwapQuery(place: string): string {
  return (
    `Search the web for "bike swap" or "bicycle swap" events and organizations in ${place}. ` +
    `Include bike co-ops, cycling clubs, and community bike exchanges.`
  );
}

function skiSwapQuery(place: string): string {
  return (
    `Search the web for "ski swap" events and organizations in ${place}. ` +
    `Include ski clubs, patrol groups, and resort-area community swaps.`
  );
}

function facebookGearSwapQuery(place: string): string {
  return (
    `Search site:facebook.com/events for "gear swap" or "equipment swap" events in ${place}. ` +
    `Include community and nonprofit swap events listed on Facebook — clubs, schools, volunteer groups.`
  );
}

function eventbriteGearSwapQuery(place: string): string {
  return (
    `Search site:eventbrite.com for "gear swap" or community equipment swap events in ${place}. ` +
    `Include nonprofit and community-organized swaps.`
  );
}

function hockeyGearSwapQuery(place: string): string {
  return (
    `Search the web for "hockey gear swap" or hockey equipment exchange events in ${place}. ` +
    `Include youth hockey associations, rink programs, and community hockey swaps.`
  );
}

function kidsConsignmentQuery(place: string): string {
  return (
    `Search the web for kids sports equipment swap, consignment sale, or exchange events in ${place}. ` +
    `Include school PTAs, youth sports leagues, and community consignment sales.`
  );
}

function nordicSkiSwapQuery(place: string): string {
  return (
    `Search the web for "Nordic ski swap" or cross-country ski equipment swap events in ${place}. ` +
    `Include Nordic ski clubs and community cross-country ski swaps.`
  );
}

function addSuperjobJobs(jobs: Job[], sj: Superjob): void {
  const slug = sj.id;
  const place = sj.queryPlace;
  const label = sj.label;

  jobs.push(
    makeJob(`sj-gear-${slug}`, `${label} — gear swap`, 'gear', gearSwapQuery(place), {
      season: 'all-season',
    })
  );
  jobs.push(
    makeJob(`sj-bike-${slug}`, `${label} — bike swap`, 'bike', bikeSwapQuery(place), {
      season: 'bike-spring',
    })
  );

  if (superjobTouchesState(sj, SKI_STATE_CODES)) {
    jobs.push(
      makeJob(`sj-ski-${slug}`, `${label} — ski swap`, 'ski', skiSwapQuery(place), {
        season: 'ski-fall',
      })
    );
  }

  jobs.push(
    makeJob(
      `sj-kids-${slug}`,
      `${label} — kids equipment swap`,
      'sports',
      kidsConsignmentQuery(place),
      { season: 'all-season' }
    )
  );

  if (superjobTouchesState(sj, HOCKEY_STATE_CODES)) {
    jobs.push(
      makeJob(
        `sj-hockey-${slug}`,
        `${label} — hockey gear swap`,
        'sports',
        hockeyGearSwapQuery(place),
        { season: 'all-season' }
      )
    );
  }

  if (superjobTouchesState(sj, NORDIC_SKI_STATE_CODES)) {
    jobs.push(
      makeJob(
        `sj-nordic-${slug}`,
        `${label} — Nordic ski swap`,
        'ski',
        nordicSkiSwapQuery(place),
        { season: 'ski-fall' }
      )
    );
  }

  if (sj.approxPopM >= PLATFORM_PASS_MIN_POP_M) {
    jobs.push(
      makeJob(
        `sj-fb-gear-${slug}`,
        `${label} — gear swap (Facebook)`,
        'gear',
        facebookGearSwapQuery(place),
        { season: 'all-season', source: 'Facebook' }
      )
    );
    jobs.push(
      makeJob(
        `sj-eb-gear-${slug}`,
        `${label} — gear swap (Eventbrite)`,
        'gear',
        eventbriteGearSwapQuery(place),
        { season: 'all-season', source: 'Eventbrite' }
      )
    );
  }
}

/** Regional discovery grid: one superjob bundle per ~10M-population region. */
export function buildRegionalJobs(): Job[] {
  const jobs: Job[] = [];
  for (const sj of SUPERJOBS) {
    addSuperjobJobs(jobs, sj);
  }
  return jobs;
}

export const REGIONAL_JOBS = buildRegionalJobs();
