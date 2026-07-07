import { SwapEvent } from './types';

const SEASON_WORDS = ['spring', 'summer', 'fall', 'autumn', 'winter'] as const;
const MONTH_WORDS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** Infer "this spring" / "this October" from discovery date text. */
export function timingPhraseFromDate(dateStr: string): string | null {
  const lower = dateStr.toLowerCase();
  for (const season of SEASON_WORDS) {
    if (lower.includes(season)) {
      return `this ${season === 'autumn' ? 'fall' : season}`;
    }
  }
  for (const month of MONTH_WORDS) {
    if (lower.includes(month)) {
      return `this ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
    }
  }
  const annualMatch = dateStr.match(/annual\s*[-–]\s*(\w+)/i);
  if (annualMatch) {
    return timingPhraseFromDate(annualMatch[1]);
  }
  return null;
}

export function buildEventSpecificLineFallback(event: SwapEvent): string {
  const eventName = event.name.trim();
  const timing = timingPhraseFromDate(event.date || '');
  if (!eventName || !timing) return '';
  return `Looks like the ${eventName} is coming up ${timing} — hope planning's going well.`;
}

export function resolveEventSpecificLine(
  event: SwapEvent,
  fromEnrichment: string | undefined
): string {
  const trimmed = (fromEnrichment || '').trim();
  if (trimmed) return trimmed;
  return buildEventSpecificLineFallback(event);
}
