/**
 * Superjobs partition the US into ~10M-population search regions.
 * Each superjob becomes several discovery jobs (gear, bike, ski, etc.).
 *
 * Large states may appear in multiple superjobs with different queryPlace text.
 * Anthropic receives the natural-language region — we do not geocode or filter.
 */

export interface Superjob {
  id: string;
  label: string;
  /** Passed verbatim into discovery prompts (e.g. "Washington state and Alaska"). */
  queryPlace: string;
  /** Approximate population (millions), for docs and platform-pass threshold. */
  approxPopM: number;
  /** US state codes in this region — used for ski / hockey / nordic job flags. */
  stateCodes: string[];
}

/** Facebook + Eventbrite gear passes run for superjobs at or above this population. */
export const PLATFORM_PASS_MIN_POP_M = 8;

/**
 * ~34 superjobs covering the US (~330M ÷ ~10M).
 * Populations are approximate (2020–2023 Census / metro estimates).
 * Ordered roughly by distance from the Pacific Northwest (Seattle), radiating outward.
 */
export const SUPERJOBS: Superjob[] = [
  {
    id: 'mss-curated',
    label: 'myskiswap clients',
    queryPlace:
      'Curated list of MySkiSwap and related platform swap organizers across North America',
    approxPopM: 0,
    stateCodes: ['WA', 'OR', 'ID', 'CO', 'AK', 'MN', 'ME'],
  },
  {
    id: 'wa-ak',
    label: 'Washington & Alaska',
    queryPlace: 'Washington state and Alaska',
    approxPopM: 8.5,
    stateCodes: ['WA', 'AK'],
  },
  {
    id: 'pnw',
    label: 'Pacific Northwest',
    queryPlace: 'Oregon, Idaho, and Hawaii',
    approxPopM: 8,
    stateCodes: ['OR', 'ID', 'HI'],
  },
  {
    id: 'north-coast-ca',
    label: 'North Coast California',
    queryPlace:
      'the North Coast and far northern California (Eureka, Redding, Chico, Monterey Bay)',
    approxPopM: 4,
    stateCodes: ['CA'],
  },
  {
    id: 'norcal',
    label: 'Northern California',
    queryPlace:
      'the San Francisco Bay Area, Sacramento, and the Central Valley of California',
    approxPopM: 10,
    stateCodes: ['CA'],
  },
  {
    id: 'la-metro',
    label: 'Greater Los Angeles',
    queryPlace: 'Greater Los Angeles and the Los Angeles metropolitan area, California',
    approxPopM: 13,
    stateCodes: ['CA'],
  },
  {
    id: 'socal-inland',
    label: 'Southern CA (non-LA)',
    queryPlace:
      'San Diego, Orange County, the Inland Empire, and desert communities of Southern California',
    approxPopM: 9,
    stateCodes: ['CA'],
  },
  {
    id: 'mountain-west',
    label: 'Mountain West',
    queryPlace: 'Colorado, Utah, Wyoming, and Montana',
    approxPopM: 11,
    stateCodes: ['CO', 'UT', 'WY', 'MT'],
  },
  {
    id: 'southwest',
    label: 'Southwest',
    queryPlace: 'Arizona, New Mexico, and Nevada',
    approxPopM: 12,
    stateCodes: ['AZ', 'NM', 'NV'],
  },
  {
    id: 'west-tx-plains',
    label: 'West Texas & southern Plains',
    queryPlace: 'West Texas, Oklahoma, and Kansas',
    approxPopM: 10,
    stateCodes: ['TX', 'OK', 'KS'],
  },
  {
    id: 'great-plains',
    label: 'Great Plains',
    queryPlace: 'Iowa, Nebraska, South Dakota, and North Dakota',
    approxPopM: 7,
    stateCodes: ['IA', 'NE', 'SD', 'ND'],
  },
  {
    id: 'upper-midwest',
    label: 'Upper Midwest',
    queryPlace: 'Minnesota and Wisconsin',
    approxPopM: 12,
    stateCodes: ['MN', 'WI'],
  },
  {
    id: 'chicago-metro',
    label: 'Chicago metro',
    queryPlace: 'Greater Chicago, northeastern Illinois, and northwest Indiana',
    approxPopM: 10,
    stateCodes: ['IL', 'IN'],
  },
  {
    id: 'michigan',
    label: 'Michigan',
    queryPlace: 'Michigan',
    approxPopM: 10,
    stateCodes: ['MI'],
  },
  {
    id: 'ohio',
    label: 'Ohio',
    queryPlace: 'Ohio',
    approxPopM: 12,
    stateCodes: ['OH'],
  },
  {
    id: 'indiana',
    label: 'Indiana',
    queryPlace: 'Indiana',
    approxPopM: 7,
    stateCodes: ['IN'],
  },
  {
    id: 'mo-arkansas',
    label: 'Missouri & Arkansas',
    queryPlace: 'Missouri and Arkansas',
    approxPopM: 9,
    stateCodes: ['MO', 'AR'],
  },
  {
    id: 'tn-ky',
    label: 'Tennessee & Kentucky',
    queryPlace: 'Tennessee and Kentucky',
    approxPopM: 11,
    stateCodes: ['TN', 'KY'],
  },
  {
    id: 'la-ms',
    label: 'Louisiana & Mississippi',
    queryPlace: 'Louisiana and Mississippi',
    approxPopM: 8,
    stateCodes: ['LA', 'MS'],
  },
  {
    id: 'dfw',
    label: 'Dallas–Fort Worth',
    queryPlace: 'the Dallas–Fort Worth metropolitan area and North Texas',
    approxPopM: 8,
    stateCodes: ['TX'],
  },
  {
    id: 'houston',
    label: 'Houston',
    queryPlace: 'Greater Houston and the Texas Gulf Coast',
    approxPopM: 7,
    stateCodes: ['TX'],
  },
  {
    id: 'austin-sa',
    label: 'Austin & San Antonio',
    queryPlace: 'Austin, San Antonio, and central Texas',
    approxPopM: 6,
    stateCodes: ['TX'],
  },
  {
    id: 'pittsburgh-appalachia',
    label: 'Western PA & Appalachia',
    queryPlace: 'western Pennsylvania and West Virginia',
    approxPopM: 7,
    stateCodes: ['PA', 'WV'],
  },
  {
    id: 'north-fl-al',
    label: 'North Florida & Alabama',
    queryPlace: 'Jacksonville, the Florida Panhandle, and Alabama',
    approxPopM: 10,
    stateCodes: ['FL', 'AL'],
  },
  {
    id: 'atlanta-ga',
    label: 'Georgia',
    queryPlace: 'Greater Atlanta and Georgia',
    approxPopM: 11,
    stateCodes: ['GA'],
  },
  {
    id: 'carolinas',
    label: 'Carolinas',
    queryPlace: 'North Carolina and South Carolina',
    approxPopM: 16,
    stateCodes: ['NC', 'SC'],
  },
  {
    id: 'virginia',
    label: 'Virginia',
    queryPlace: 'Virginia outside the immediate DC suburbs',
    approxPopM: 6,
    stateCodes: ['VA'],
  },
  {
    id: 'dc-maryland',
    label: 'DC & Maryland',
    queryPlace: 'the Washington DC metropolitan area and Maryland',
    approxPopM: 10,
    stateCodes: ['MD', 'VA'],
  },
  {
    id: 'philly-mid-atl',
    label: 'Philadelphia & mid-Atlantic',
    queryPlace:
      'Greater Philadelphia, southeastern Pennsylvania, Delaware, and southern New Jersey',
    approxPopM: 10,
    stateCodes: ['PA', 'DE', 'NJ'],
  },
  {
    id: 'boston-corridor',
    label: 'Boston corridor',
    queryPlace: 'Greater Boston, Massachusetts, Rhode Island, and Connecticut',
    approxPopM: 12,
    stateCodes: ['MA', 'RI', 'CT'],
  },
  {
    id: 'upstate-ne',
    label: 'Upstate NY & northern New England',
    queryPlace:
      'upstate New York (Buffalo, Rochester, Albany, Syracuse) and Vermont, New Hampshire, and Maine',
    approxPopM: 11,
    stateCodes: ['NY', 'VT', 'NH', 'ME'],
  },
  {
    id: 'nyc-metro',
    label: 'New York City metro',
    queryPlace:
      'the New York City metropolitan area, Long Island, and northern New Jersey',
    approxPopM: 20,
    stateCodes: ['NY', 'NJ'],
  },
  {
    id: 'central-fl',
    label: 'Central Florida',
    queryPlace: 'Tampa, Orlando, and Central Florida',
    approxPopM: 6,
    stateCodes: ['FL'],
  },
  {
    id: 'south-fl',
    label: 'South Florida',
    queryPlace: 'Miami, Fort Lauderdale, and South Florida',
    approxPopM: 7,
    stateCodes: ['FL'],
  },
];

export function superjobTouchesState(sj: Superjob, codes: Set<string>): boolean {
  return sj.stateCodes.some((c) => codes.has(c));
}
