export interface SwapEvent {
  id: string;
  jobId: string;
  name: string;
  organizer: string;
  eventUrl: string;
  location: string;
  type: 'bike' | 'ski' | 'gear' | 'sports' | 'other';
  source: string;
  date: string;
  description: string;
  enriched: boolean;
  discoveredAt: string;
}

export interface LinkedInPerson {
  name: string;
  location: string;
  role: string;
}

export interface EnrichedContact {
  sourceId: string;
  orgName: string;
  location: string;
  type: string;
  email: string;
  phone: string;
  facebook: string;
  linkedinPeople: LinkedInPerson[];
  website: string;
  notes: string;
  enrichedAt: string;
  contactFound: boolean;
}

export type JobSeason = 'bike-spring' | 'ski-fall' | 'all-season';

export interface Job {
  id: string;
  name: string;
  description: string;
  type: 'bike' | 'ski' | 'gear' | 'sports' | 'other';
  source: 'Eventbrite' | 'Web' | 'Facebook';
  searchQuery: string;
  status: 'pending' | 'running' | 'done' | 'error';
  foundCount: number;
  error?: string;
  /** When set, job re-runs each year during its pre-season window. */
  season?: JobSeason;
  /** ISO timestamp — set when job last completed successfully. */
  completedAt?: string;
}

export interface RunOptions {
  jobs?: string[];
  enrichOnly: boolean;
  discoverOnly: boolean;
  regionalOnly: boolean;
  nationwideOnly: boolean;
  allowSeasonalRefresh: boolean;
  concurrency: number;
  delayMs: number;
  outputDir: string;
  enrichLimit?: number;
  discoveryModel?: string;
  enrichmentModel?: string;
}

export interface RawDiscoveryResult {
  name: string;
  organizer: string;
  eventUrl: string;
  location: string;
  type: 'bike' | 'ski' | 'gear' | 'sports' | 'other';
  source: string;
  date: string;
  description: string;
}

export interface RawEnrichmentResult {
  email: string;
  phone: string;
  facebook: string;
  linkedinPeople: LinkedInPerson[];
  website: string;
  notes: string;
}
