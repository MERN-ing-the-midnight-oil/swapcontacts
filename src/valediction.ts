export const DEFAULT_VALEDICTION = 'Sincerely';

const TYPE_VALEDICTIONS: Record<string, string> = {
  bike: 'Happy riding',
  ski: 'See you on the trails',
  gear: 'Happy adventuring',
  sports: 'See you out there',
};

export function inferValedictionFromType(type: string | undefined): string {
  return TYPE_VALEDICTIONS[(type || '').toLowerCase()] || DEFAULT_VALEDICTION;
}

export function needsValedictionBackfill(valediction: string | undefined): boolean {
  const trimmed = (valediction || '').trim();
  return !trimmed || trimmed.toLowerCase() === DEFAULT_VALEDICTION.toLowerCase();
}

export function resolveValediction(
  fromEnrichment: string | undefined,
  type?: string
): string {
  const trimmed = (fromEnrichment || '').trim();
  if (trimmed && trimmed.toLowerCase() !== DEFAULT_VALEDICTION.toLowerCase()) {
    return trimmed;
  }
  if (type) return inferValedictionFromType(type);
  return trimmed || DEFAULT_VALEDICTION;
}
