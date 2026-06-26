/** Models listed on Anthropic pricing (excluding deprecated, retired, limited availability). */
export interface ClaudeModelOption {
  id: string;
  label: string;
  /** USD per million input tokens */
  inputPerMTok: number;
  /** USD per million output tokens */
  outputPerMTok: number;
}

export const CLAUDE_MODELS: ClaudeModelOption[] = [
  { id: 'claude-fable-5', label: 'Claude Fable 5', inputPerMTok: 10, outputPerMTok: 50 },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', inputPerMTok: 5, outputPerMTok: 25 },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', inputPerMTok: 5, outputPerMTok: 25 },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', inputPerMTok: 5, outputPerMTok: 25 },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', inputPerMTok: 5, outputPerMTok: 25 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', inputPerMTok: 3, outputPerMTok: 15 },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', inputPerMTok: 3, outputPerMTok: 15 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', inputPerMTok: 1, outputPerMTok: 5 },
];

export const DEFAULT_DISCOVERY_MODEL = 'claude-opus-4-5';
export const DEFAULT_ENRICHMENT_MODEL = 'claude-sonnet-4-5';

const ALLOWED = new Set(CLAUDE_MODELS.map((m) => m.id));
const BY_ID = new Map(CLAUDE_MODELS.map((m) => [m.id, m]));

export function isAllowedModel(id: string): boolean {
  return ALLOWED.has(id);
}

export function resolveDiscoveryModel(id?: string): string {
  return id && isAllowedModel(id) ? id : DEFAULT_DISCOVERY_MODEL;
}

export function resolveEnrichmentModel(id?: string): string {
  return id && isAllowedModel(id) ? id : DEFAULT_ENRICHMENT_MODEL;
}

export function getModelOption(id: string): ClaudeModelOption | undefined {
  return BY_ID.get(id);
}

export function formatModelWithPricing(id: string): string {
  const m = BY_ID.get(id);
  if (!m) return id;
  return `${m.label} ($${m.inputPerMTok}/$${m.outputPerMTok} per MTok)`;
}
