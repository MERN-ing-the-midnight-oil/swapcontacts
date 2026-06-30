import Anthropic from '@anthropic-ai/sdk';
import { SwapEvent, EnrichedContact, RawEnrichmentResult } from './types';
import { normalizeLinkedinPeople } from './linkedin-people';
import {
  getClient,
  callWithRetry,
  extractTextFromResponse,
  extractJsonObject,
} from './search';
import { saveDebugResponse, markEnriched, saveContact } from './storage';
import { logError, logContactResults } from './logger';

import { DEFAULT_ENRICHMENT_MODEL } from './models';
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
} as unknown as Anthropic.Messages.Tool;

function buildEnrichmentPrompt(event: SwapEvent): string {
  return `Find contact information for this swap event organizer:

Organization/Event: "${event.name}"
Organizer: "${event.organizer}"
Location: "${event.location}"
Event URL: "${event.eventUrl}"
Event type: ${event.type} swap

Search the web to find their:
1. Email address (check their website, Facebook About page, Eventbrite organizer profile)
2. Phone number
3. Facebook page URL
4. Names and locations of gear swap Directors, Organizers, or Volunteers (from event pages, news articles, org websites, Facebook posts — only real names you find cited)
5. Website URL (not Eventbrite — their own domain)

Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
{"email":"","phone":"","facebook":"","linkedinPeople":[{"name":"","location":"","role":""}],"website":"","notes":"1 sentence about the org"}

For linkedinPeople: each entry needs name (required), location (city/state when known, else event area), and role ("Director", "Organizer", or "Volunteer" when known). Return [] if none found. Never guess or fabricate names or contact info.`;
}

export async function enrichEvent(
  event: SwapEvent,
  outputDir: string,
  model: string = DEFAULT_ENRICHMENT_MODEL
): Promise<EnrichedContact> {
  const anthropic = getClient();
  const prompt = buildEnrichmentPrompt(event);

  const response = await callWithRetry(
    () =>
      anthropic.messages.create({
        model,
        max_tokens: 800,
        tools: [WEB_SEARCH_TOOL],
        messages: [{ role: 'user', content: prompt }],
      }) as Promise<Anthropic.Message>,
    `Enrichment ${event.id}`
  );

  const rawText = extractTextFromResponse(response.content);
  const jsonStr = extractJsonObject(rawText);

  if (!jsonStr) {
    const debugPath = await saveDebugResponse(
      outputDir,
      `enrich-${event.id}`,
      rawText
    );
    logError(
      `Failed to parse enrichment JSON for ${event.name}. Raw response saved to ${debugPath}`
    );
    throw new Error(`JSON parse failure for enrichment ${event.id}`);
  }

  let parsed: RawEnrichmentResult;
  try {
    parsed = JSON.parse(jsonStr) as RawEnrichmentResult;
  } catch {
    const debugPath = await saveDebugResponse(
      outputDir,
      `enrich-${event.id}`,
      rawText
    );
    logError(
      `Failed to parse enrichment JSON for ${event.name}. Raw response saved to ${debugPath}`
    );
    throw new Error(`JSON parse failure for enrichment ${event.id}`);
  }

  const email = parsed.email || '';
  const phone = parsed.phone || '';
  const facebook = parsed.facebook || '';
  const linkedinPeople = normalizeLinkedinPeople(parsed.linkedinPeople);
  const contactFound = !!(email || phone || facebook || linkedinPeople.length);

  const contact: EnrichedContact = {
    sourceId: event.id,
    orgName: event.name,
    location: event.location,
    type: event.type,
    email,
    phone,
    facebook,
    linkedinPeople,
    website: parsed.website || '',
    notes: parsed.notes || '',
    enrichedAt: new Date().toISOString(),
    contactFound,
  };

  await saveContact(contact, outputDir);
  await markEnriched(event.id, outputDir);

  logContactResults({ email, phone, facebook, linkedinPeopleCount: linkedinPeople.length });

  return contact;
}
