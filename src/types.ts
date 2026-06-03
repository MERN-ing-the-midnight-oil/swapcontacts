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

export interface EnrichedContact {
  sourceId: string;
  orgName: string;
  location: string;
  type: string;
  email: string;
  phone: string;
  facebook: string;
  website: string;
  notes: string;
  enrichedAt: string;
  contactFound: boolean;
}

export interface Job {
  id: string;
  name: string;
  description: string;
  type: 'bike' | 'ski' | 'gear' | 'sports' | 'other';
  source: 'Eventbrite' | 'Web';
  searchQuery: string;
  status: 'pending' | 'running' | 'done' | 'error';
  foundCount: number;
  error?: string;
}

export interface RunOptions {
  jobs?: string[];
  enrichOnly: boolean;
  discoverOnly: boolean;
  concurrency: number;
  delayMs: number;
  outputDir: string;
  enrichLimit?: number;
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
  website: string;
  notes: string;
}
