import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Job, RawDiscoveryResult, SwapEvent } from './types';
import { saveDebugResponse } from './storage';
import { logError, logWarn } from './logger';

dotenv.config();

const DISCOVERY_MODEL = 'claude-opus-4-5';
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
} as unknown as Anthropic.Messages.Tool;

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.'
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let rateLimitRetries = 0;
  let networkRetried = false;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && rateLimitRetries < 3) {
        const waitMs = 60_000 * Math.pow(2, rateLimitRetries);
        rateLimitRetries++;
        logWarn(
          `${label}: rate limited, retrying in ${waitMs / 1000}s (attempt ${rateLimitRetries}/3)...`
        );
        await sleep(waitMs);
        continue;
      }

      if (isNetworkError(error) && !networkRetried) {
        networkRetried = true;
        logWarn(`${label}: network error, retrying in 5s...`);
        await sleep(5000);
        continue;
      }

      throw error;
    }
  }
}

export function extractTextFromResponse(
  content: Anthropic.Messages.ContentBlock[]
): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function extractJsonArray(text: string): string | null {
  const cleaned = stripMarkdownFences(text);
  const start = cleaned.indexOf('[');
  if (start === -1) return null;

  // Prefer last complete array (greedy match can include trailing prose)
  const arrays = cleaned.match(/\[[\s\S]*?\](?=\s*(?:\n|$|Based on|Here|The |If nothing))/g);
  if (arrays && arrays.length > 0) {
    return arrays[arrays.length - 1];
  }

  const greedy = cleaned.slice(start).match(/\[[\s\S]*\]/);
  return greedy ? greedy[0] : cleaned.slice(start);
}

/** Parse JSON array; salvage truncated responses by keeping complete objects. */
export function parseJsonArray(text: string): RawDiscoveryResult[] | null {
  const jsonStr = extractJsonArray(text);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr) as RawDiscoveryResult[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Truncated mid-array: recover complete objects
    const inner = jsonStr.replace(/^\[/, '').replace(/\]$/, '');
    const objects: RawDiscoveryResult[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (inner[i] === '}') {
        depth--;
        if (depth === 0) {
          try {
            objects.push(JSON.parse(inner.slice(start, i + 1)) as RawDiscoveryResult);
          } catch {
            // skip malformed object
          }
        }
      }
    }
    return objects.length > 0 ? objects : null;
  }
}

export function extractJsonObject(text: string): string | null {
  const cleaned = stripMarkdownFences(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export function generateEventId(name: string, location: string): string {
  const key = name.toLowerCase().trim() + location.toLowerCase().trim();
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 12);
}

function buildDiscoveryPrompt(job: Job): string {
  return `You are helping build a database of non-profit gear swap events in the USA.

${job.searchQuery}

For each event or organization found, extract:
- name: the event or organization name
- organizer: the organizing entity (club, nonprofit, etc.)
- eventUrl: direct URL to the event or organization page
- location: city and state (e.g. "Portland, OR")
- type: one of: bike | ski | gear | sports | other
- source: where you found it (Eventbrite, Facebook, website, etc.)
- date: when the event occurs (e.g. "Annual - October" or "Spring 2025")
- description: 1-2 sentences about the event

Return ONLY a valid JSON array. No markdown, no backticks, no explanation.
Example: [{"name":"...","organizer":"...","eventUrl":"...","location":"...","type":"bike","source":"Eventbrite","date":"Annual - October","description":"..."}]

If nothing is found, return an empty array: []
Find as many distinct events as possible, but cap at 12 entries so the response stays valid JSON.`;
}

function normalizeType(
  type: string,
  fallback: Job['type']
): SwapEvent['type'] {
  const valid = ['bike', 'ski', 'gear', 'sports', 'other'] as const;
  const normalized = type?.toLowerCase().trim() as SwapEvent['type'];
  return valid.includes(normalized) ? normalized : fallback;
}

export async function runDiscoveryJob(
  job: Job,
  outputDir: string
): Promise<SwapEvent[]> {
  const anthropic = getClient();
  const prompt = buildDiscoveryPrompt(job);

  const response = await callWithRetry(
    () =>
      anthropic.messages.create({
        model: DISCOVERY_MODEL,
        max_tokens: 8192,
        tools: [WEB_SEARCH_TOOL],
        messages: [{ role: 'user', content: prompt }],
      }) as Promise<Anthropic.Message>,
    `Discovery ${job.id}`
  );

  const rawText = extractTextFromResponse(response.content);
  const parsed = parseJsonArray(rawText);

  if (!parsed) {
    const debugPath = await saveDebugResponse(outputDir, job.id, rawText);
    logError(`Failed to parse JSON for job ${job.id}. Raw response saved to ${debugPath}`);
    throw new Error(`JSON parse failure for job ${job.id}`);
  }

  const now = new Date().toISOString();
  return parsed.map((item) => ({
    id: generateEventId(item.name || '', item.location || ''),
    jobId: job.id,
    name: item.name || '',
    organizer: item.organizer || '',
    eventUrl: item.eventUrl || '',
    location: item.location || '',
    type: normalizeType(item.type, job.type),
    source: item.source || job.source,
    date: item.date || '',
    description: item.description || '',
    enriched: false,
    discoveredAt: now,
  }));
}
