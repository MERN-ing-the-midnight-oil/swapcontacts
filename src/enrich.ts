import Anthropic from '@anthropic-ai/sdk';
import { SwapEvent, EnrichedContact, RawEnrichmentResult } from './types';
import { normalizeLinkedinPeople } from './linkedin-people';
import { resolveEventSpecificLine } from './event-specific-line';
import { resolveValediction, needsValedictionBackfill } from './valediction';
import {
  getClient,
  callWithRetry,
  extractTextFromResponse,
  extractJsonObject,
} from './search';
import { saveDebugResponse, markEnriched, saveContact, loadContacts, rewriteContacts } from './storage';
import { logError, logContactResults, logInfo, logSuccess, logRunning, startSpinner, stopSpinner } from './logger';

import { DEFAULT_ENRICHMENT_MODEL } from './models';
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
} as unknown as Anthropic.Messages.Tool;

function buildEnrichmentPrompt(event: SwapEvent): string {
  const scheduleHint = event.date
    ? `Known schedule from discovery (may be incomplete): "${event.date}"`
    : 'Known schedule from discovery: none yet';
  const descriptionHint = event.description
    ? `Event description: "${event.description}"`
    : '';

  return `Find contact information for this swap event organizer:

Organization/Event: "${event.name}"
Organizer: "${event.organizer}"
Location: "${event.location}"
Event URL: "${event.eventUrl}"
Event type: ${event.type} swap
${scheduleHint}
${descriptionHint}

Search the web to find their:
1. Email address (check their website, Facebook About page, Eventbrite organizer profile)
2. Phone number
3. Facebook page URL
4. Names and locations of gear swap Directors, Organizers, or Volunteers (from event pages, news articles, org websites, Facebook posts — only real names you find cited)
5. Website URL (not Eventbrite — their own domain)
6. When their next swap is (or typically runs) — check event pages, Facebook events, news, and registration posts

Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
{"email":"","phone":"","facebook":"","linkedinPeople":[{"name":"","location":"","role":""}],"website":"","notes":"1 sentence about the org","eventSpecificLine":"","valediction":""}

For linkedinPeople: each entry needs name (required), location (city/state when known, else event area), and role ("Director", "Organizer", or "Volunteer" when known). Return [] if none found. Never guess or fabricate names or contact info.

For eventSpecificLine: one short friendly opener about their upcoming or typical swap timing, using the real event name. Example: "Looks like the Seattle Bike Swap is coming up this spring — hope planning's going well." Use natural season/month phrasing ("this fall", "this October"). Return "" if timing is unknown — do not guess dates.

For valediction: a short tailored sign-off phrase to use instead of "Sincerely". Make it specific to the *kind* of swap — not a generic sport greeting. Use insider jargon or culture from that community. Examples: "Keep your stick on the ice" for a hockey consignment event, "See you on the trails" for a ski/nordic swap, "Happy riding" for a bicycle swap. For a motorbike/motorcycle swap, prefer something like "Keep the rubber side down" over a generic "Stay safe" or "Ride safe". One brief phrase only, no comma, no name. Return "" if nothing fits naturally — the app will fall back to "Sincerely".`;
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
        max_tokens: 1024,
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
    eventSpecificLine: resolveEventSpecificLine(event, parsed.eventSpecificLine),
    valediction: resolveValediction(parsed.valediction, event.type),
    enrichedAt: new Date().toISOString(),
    contactFound,
  };

  await saveContact(contact, outputDir);
  await markEnriched(event.id, outputDir);

  logContactResults({ email, phone, facebook, linkedinPeopleCount: linkedinPeople.length });

  return contact;
}

function buildValedictionBackfillPrompt(contact: EnrichedContact): string {
  return `Suggest a short tailored email sign-off phrase for this nonprofit gear swap organizer instead of "Sincerely".

Make it specific to the *kind* of swap — not a generic sport greeting. Use insider jargon or culture from that community.

Organization: "${contact.orgName}"
Event type: ${contact.type} swap
Location: ${contact.location}
Notes: ${contact.notes || '(none)'}

Examples: "Happy riding" for a bicycle swap, "See you on the trails" for a ski/nordic swap, "Keep your stick on the ice" for hockey gear. For a motorbike/motorcycle swap, prefer something like "Keep the rubber side down" over a generic "Stay safe" or "Ride safe".

Return ONLY valid JSON. No markdown, no backticks, no explanation.
{"valediction":""}

One brief phrase only — no comma, no name. Return "" if nothing fits naturally.`;
}

export async function backfillValedictionForContact(
  contact: EnrichedContact,
  model: string = DEFAULT_ENRICHMENT_MODEL
): Promise<string> {
  const anthropic = getClient();
  const prompt = buildValedictionBackfillPrompt(contact);

  const response = await callWithRetry(
    () =>
      anthropic.messages.create({
        model,
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      }) as Promise<Anthropic.Message>,
    `Valediction ${contact.sourceId}`
  );

  const rawText = extractTextFromResponse(response.content);
  const jsonStr = extractJsonObject(rawText);
  if (!jsonStr) {
    return resolveValediction('', contact.type);
  }

  try {
    const parsed = JSON.parse(jsonStr) as { valediction?: string };
    return resolveValediction(parsed.valediction, contact.type);
  } catch {
    return resolveValediction('', contact.type);
  }
}

export async function backfillValedictions(
  outputDir: string,
  model: string = DEFAULT_ENRICHMENT_MODEL,
  limit?: number
): Promise<number> {
  const contacts = await loadContacts(outputDir);
  let targets = Array.from(contacts.values()).filter((c) =>
    needsValedictionBackfill(c.valediction)
  );
  if (limit && limit > 0) {
    targets = targets.slice(0, limit);
  }

  if (targets.length === 0) {
    logInfo('No contacts need valediction backfill.');
    return 0;
  }

  logInfo(`Backfilling valedictions for ${targets.length} contact(s)...`);

  for (const [index, contact] of targets.entries()) {
    logRunning(`▶ [${index + 1}/${targets.length}] ${contact.orgName}`);
    const spinner = startSpinner(`Generating sign-off for ${contact.orgName}...`);
    try {
      const valediction = await backfillValedictionForContact(contact, model);
      contacts.set(contact.sourceId, { ...contact, valediction });
      stopSpinner(true, `${contact.orgName}: ${valediction}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stopSpinner(false, `Failed: ${contact.orgName}`);
      logError(`  ✗ ${contact.orgName}: ${msg}`);
    }
  }

  await rewriteContacts(contacts, outputDir);
  logSuccess(`Updated valedictions for ${targets.length} contact(s).`);
  return targets.length;
}
