import { getModelOption } from './models';
import { SuperjobRunRecord } from './superjob-runs';

/** Anthropic web search: $10 per 1,000 searches. */
export const WEB_SEARCH_USD_PER_SEARCH = 0.01;

/**
 * Per-discovery-call averages (sampled Opus + web_search nationwide/regional jobs).
 * Search-result tokens dominate input; each job returns up to ~12 events.
 */
const DISCOVERY_AVG = {
  inputTokens: 100_000,
  outputTokens: 3_000,
  webSearches: 6,
  inputTokensLow: 60_000,
  inputTokensHigh: 180_000,
  outputTokensLow: 1_500,
  outputTokensHigh: 6_000,
  webSearchesLow: 4,
  webSearchesHigh: 10,
};

/**
 * Per-enrichment-call averages (sampled Sonnet + web_search on WA+AK events).
 */
const ENRICHMENT_AVG = {
  inputTokens: 29_800,
  outputTokens: 230,
  webSearches: 3,
  inputTokensLow: 17_650,
  inputTokensHigh: 52_500,
  outputTokensLow: 168,
  outputTokensHigh: 292,
  webSearchesLow: 2,
  webSearchesHigh: 4,
};

export interface PhaseCostEstimate {
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
  tokenCostUsd: number;
  searchCostUsd: number;
  subtotalUsd: number;
}

export interface RunCostEstimate {
  discovery: PhaseCostEstimate;
  enrichment: PhaseCostEstimate;
  totalUsd: number;
  totalLowUsd: number;
  totalHighUsd: number;
  formattedTotal: string;
  formattedRange: string;
  disclaimer: string;
}

function tokenCostUsd(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const model = getModelOption(modelId);
  if (!model) return 0;
  return (
    (inputTokens / 1_000_000) * model.inputPerMTok +
    (outputTokens / 1_000_000) * model.outputPerMTok
  );
}

function phaseEstimate(
  apiCalls: number,
  modelId: string,
  avg: {
    inputTokens: number;
    outputTokens: number;
    webSearches: number;
  }
): PhaseCostEstimate {
  const inputTokens = apiCalls * avg.inputTokens;
  const outputTokens = apiCalls * avg.outputTokens;
  const webSearches = apiCalls * avg.webSearches;
  const tokenCost = tokenCostUsd(inputTokens, outputTokens, modelId);
  const searchCost = webSearches * WEB_SEARCH_USD_PER_SEARCH;
  return {
    apiCalls,
    inputTokens,
    outputTokens,
    webSearches,
    tokenCostUsd: tokenCost,
    searchCostUsd: searchCost,
    subtotalUsd: tokenCost + searchCost,
  };
}

function phaseEstimateRange(
  apiCalls: number,
  modelId: string,
  low: { inputTokens: number; outputTokens: number; webSearches: number },
  high: { inputTokens: number; outputTokens: number; webSearches: number }
): { low: number; high: number } {
  const lowTokens = tokenCostUsd(
    apiCalls * low.inputTokens,
    apiCalls * low.outputTokens,
    modelId
  );
  const highTokens = tokenCostUsd(
    apiCalls * high.inputTokens,
    apiCalls * high.outputTokens,
    modelId
  );
  const lowSearch = apiCalls * low.webSearches * WEB_SEARCH_USD_PER_SEARCH;
  const highSearch = apiCalls * high.webSearches * WEB_SEARCH_USD_PER_SEARCH;
  return { low: lowTokens + lowSearch, high: highTokens + highSearch };
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function estimateSuperjobRunCost(record: SuperjobRunRecord): RunCostEstimate {
  const discoveryCalls = record.discoveryJobIds?.length || 0;
  const enrichmentCalls = record.contactCount || record.eventCount || 0;

  const discovery = phaseEstimate(
    discoveryCalls,
    record.discoveryModel,
    DISCOVERY_AVG
  );
  const enrichment = phaseEstimate(
    enrichmentCalls,
    record.enrichmentModel,
    ENRICHMENT_AVG
  );

  const discoveryRange = phaseEstimateRange(
    discoveryCalls,
    record.discoveryModel,
    {
      inputTokens: DISCOVERY_AVG.inputTokensLow,
      outputTokens: DISCOVERY_AVG.outputTokensLow,
      webSearches: DISCOVERY_AVG.webSearchesLow,
    },
    {
      inputTokens: DISCOVERY_AVG.inputTokensHigh,
      outputTokens: DISCOVERY_AVG.outputTokensHigh,
      webSearches: DISCOVERY_AVG.webSearchesHigh,
    }
  );
  const enrichmentRange = phaseEstimateRange(
    enrichmentCalls,
    record.enrichmentModel,
    {
      inputTokens: ENRICHMENT_AVG.inputTokensLow,
      outputTokens: ENRICHMENT_AVG.outputTokensLow,
      webSearches: ENRICHMENT_AVG.webSearchesLow,
    },
    {
      inputTokens: ENRICHMENT_AVG.inputTokensHigh,
      outputTokens: ENRICHMENT_AVG.outputTokensHigh,
      webSearches: ENRICHMENT_AVG.webSearchesHigh,
    }
  );

  const totalUsd = discovery.subtotalUsd + enrichment.subtotalUsd;
  const totalLowUsd = discoveryRange.low + enrichmentRange.low;
  const totalHighUsd = discoveryRange.high + enrichmentRange.high;

  return {
    discovery,
    enrichment,
    totalUsd,
    totalLowUsd,
    totalHighUsd,
    formattedTotal: formatUsd(totalUsd),
    formattedRange: `${formatUsd(totalLowUsd)} – ${formatUsd(totalHighUsd)}`,
    disclaimer:
      'Estimated from average token and web-search usage per API call. Actual billing may differ; the pipeline does not log exact usage yet.',
  };
}
