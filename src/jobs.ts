import { Job } from './types';
import { REGIONAL_JOBS } from './jobs-regional';

/** Original nationwide discovery jobs (12). */
export const NATIONWIDE_JOBS: Job[] = [
  {
    id: 'eb-bike',
    name: 'Eventbrite — bike swap',
    description: 'Search Eventbrite for bike swap events nationwide',
    type: 'bike',
    source: 'Eventbrite',
    searchQuery:
      'Search eventbrite.com for "bike swap" events in the USA. Look through multiple pages of results.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'eb-ski',
    name: 'Eventbrite — ski swap',
    description: 'Search Eventbrite for ski swap events nationwide',
    type: 'ski',
    source: 'Eventbrite',
    searchQuery: 'Search eventbrite.com for "ski swap" events in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'eb-gear',
    name: 'Eventbrite — gear swap',
    description: 'Search Eventbrite for gear swap community events nationwide',
    type: 'gear',
    source: 'Eventbrite',
    searchQuery:
      'Search eventbrite.com for "gear swap" community events in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'eb-sports',
    name: 'Eventbrite — sports equipment swap',
    description: 'Search Eventbrite for sports equipment swap events nationwide',
    type: 'sports',
    source: 'Eventbrite',
    searchQuery:
      'Search eventbrite.com for "sports equipment swap" or "equipment exchange" events in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'eb-bicycle',
    name: 'Eventbrite — bicycle exchange',
    description: 'Search Eventbrite for bicycle exchange nonprofit events nationwide',
    type: 'bike',
    source: 'Eventbrite',
    searchQuery:
      'Search eventbrite.com for "bicycle exchange" or "bike sale" nonprofit events in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-bike-fb',
    name: 'Facebook — bike swap pages',
    description: 'Search Facebook for nonprofit bike swap organizations',
    type: 'bike',
    source: 'Web',
    searchQuery:
      'Search Facebook for nonprofit organizations that run annual bike swap events in the USA. Use query: site:facebook.com "bike swap" nonprofit annual',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-ski-fb',
    name: 'Facebook — ski swap pages',
    description: 'Search Facebook for nonprofit ski swap organizations',
    type: 'ski',
    source: 'Web',
    searchQuery:
      'Search Facebook for nonprofit organizations that run annual ski swap events in the USA. Use query: site:facebook.com "ski swap" nonprofit annual',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-gear-orgs',
    name: 'Web — gear swap nonprofits',
    description: 'Search the web for nonprofit gear swap organizations',
    type: 'gear',
    source: 'Web',
    searchQuery:
      'Search the web for nonprofit organizations that run annual gear swap or equipment swap events in the USA. Look for .org websites and community organizations.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-bike-clubs',
    name: 'Web — cycling club swaps',
    description: 'Search the web for cycling clubs running swap meets',
    type: 'bike',
    source: 'Web',
    searchQuery:
      'Search the web for cycling clubs and bicycle nonprofits that run annual swap meets or used bike sales in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-ski-clubs',
    name: 'Web — ski club swaps',
    description: 'Search the web for ski clubs running swap meets',
    type: 'ski',
    source: 'Web',
    searchQuery:
      'Search the web for ski clubs that run annual ski swap meets or equipment sales in the USA.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-ymca-swaps',
    name: 'Web — YMCA gear swaps',
    description: 'Search for YMCA chapters running gear swap events',
    type: 'gear',
    source: 'Web',
    searchQuery:
      'Search for YMCA chapters or community centers in the USA that run gear swap or sports equipment exchange events.',
    status: 'pending',
    foundCount: 0,
  },
  {
    id: 'web-bike-pdfs',
    name: 'Web — bike swap flyers',
    description: 'Search for PDF flyers announcing bike swap events',
    type: 'bike',
    source: 'Web',
    searchQuery:
      'Search for PDF flyers and announcements for annual bike swap events: "bike swap" annual filetype:pdf nonprofit USA',
    status: 'pending',
    foundCount: 0,
  },
];

/** All discovery jobs: nationwide pass + regional state grid. */
export const JOBS: Job[] = [...NATIONWIDE_JOBS, ...REGIONAL_JOBS];
