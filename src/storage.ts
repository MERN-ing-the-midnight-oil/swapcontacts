import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';
import { SwapEvent, EnrichedContact } from './types';
import { parseLinkedinPeopleJson } from './linkedin-people';

const EVENTS_FILE = 'events.csv';
const CONTACTS_FILE = 'contacts.csv';

const EVENT_HEADERS = [
  { id: 'id', title: 'id' },
  { id: 'jobId', title: 'jobId' },
  { id: 'name', title: 'name' },
  { id: 'organizer', title: 'organizer' },
  { id: 'eventUrl', title: 'eventUrl' },
  { id: 'location', title: 'location' },
  { id: 'type', title: 'type' },
  { id: 'source', title: 'source' },
  { id: 'date', title: 'date' },
  { id: 'description', title: 'description' },
  { id: 'enriched', title: 'enriched' },
  { id: 'discoveredAt', title: 'discoveredAt' },
];

const CONTACT_HEADERS = [
  { id: 'sourceId', title: 'sourceId' },
  { id: 'orgName', title: 'orgName' },
  { id: 'location', title: 'location' },
  { id: 'type', title: 'type' },
  { id: 'email', title: 'email' },
  { id: 'phone', title: 'phone' },
  { id: 'facebook', title: 'facebook' },
  { id: 'linkedinPeople', title: 'linkedinPeople' },
  { id: 'website', title: 'website' },
  { id: 'notes', title: 'notes' },
  { id: 'enrichedAt', title: 'enrichedAt' },
  { id: 'contactFound', title: 'contactFound' },
];

async function ensureOutputDir(outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseBool(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

function eventToRow(event: SwapEvent): Record<string, string | boolean> {
  return {
    id: event.id,
    jobId: event.jobId,
    name: event.name,
    organizer: event.organizer,
    eventUrl: event.eventUrl,
    location: event.location,
    type: event.type,
    source: event.source,
    date: event.date,
    description: event.description,
    enriched: event.enriched,
    discoveredAt: event.discoveredAt,
  };
}

function rowToEvent(row: Record<string, string>): SwapEvent {
  return {
    id: row.id,
    jobId: row.jobId,
    name: row.name,
    organizer: row.organizer,
    eventUrl: row.eventUrl,
    location: row.location,
    type: row.type as SwapEvent['type'],
    source: row.source,
    date: row.date,
    description: row.description,
    enriched: parseBool(row.enriched),
    discoveredAt: row.discoveredAt,
  };
}

function rowToContact(row: Record<string, string>): EnrichedContact {
  return {
    sourceId: row.sourceId,
    orgName: row.orgName,
    location: row.location,
    type: row.type,
    email: row.email,
    phone: row.phone,
    facebook: row.facebook,
    linkedinPeople: parseLinkedinPeopleJson(row.linkedinPeople || row.linkedin),
    website: row.website,
    notes: row.notes,
    enrichedAt: row.enrichedAt,
    contactFound: parseBool(row.contactFound),
  };
}

export async function loadEvents(outputDir: string): Promise<Map<string, SwapEvent>> {
  await ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, EVENTS_FILE);
  const map = new Map<string, SwapEvent>();

  if (!(await fileExists(filePath))) {
    return map;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  if (!content.trim()) return map;

  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const row of rows) {
    const event = rowToEvent(row);
    map.set(event.id, event);
  }

  return map;
}

export async function saveEvents(
  events: SwapEvent[],
  outputDir: string,
  existing?: Map<string, SwapEvent>
): Promise<number> {
  await ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, EVENTS_FILE);
  const known = existing ?? (await loadEvents(outputDir));
  const toAppend: SwapEvent[] = [];

  for (const event of events) {
    if (!known.has(event.id)) {
      toAppend.push(event);
      known.set(event.id, event);
    }
  }

  if (toAppend.length === 0) return 0;

  const exists = await fileExists(filePath);
  const writer = createObjectCsvWriter({
    path: filePath,
    header: EVENT_HEADERS,
    append: exists,
  });

  await writer.writeRecords(toAppend.map(eventToRow));
  return toAppend.length;
}

export async function saveEvent(
  event: SwapEvent,
  outputDir: string,
  existing?: Map<string, SwapEvent>
): Promise<boolean> {
  const saved = await saveEvents([event], outputDir, existing);
  return saved > 0;
}

export async function rewriteEvents(
  events: Map<string, SwapEvent>,
  outputDir: string
): Promise<void> {
  await ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, EVENTS_FILE);

  const writer = createObjectCsvWriter({
    path: filePath,
    header: EVENT_HEADERS,
    append: false,
  });

  await writer.writeRecords(
    Array.from(events.values()).map(eventToRow)
  );
}

export async function markEnriched(id: string, outputDir: string): Promise<void> {
  const events = await loadEvents(outputDir);
  const event = events.get(id);
  if (!event) return;

  event.enriched = true;
  events.set(id, event);
  await rewriteEvents(events, outputDir);
}

export async function loadContacts(
  outputDir: string
): Promise<Map<string, EnrichedContact>> {
  await ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, CONTACTS_FILE);
  const map = new Map<string, EnrichedContact>();

  if (!(await fileExists(filePath))) {
    return map;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  if (!content.trim()) return map;

  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const row of rows) {
    const contact = rowToContact(row);
    map.set(contact.sourceId, contact);
  }

  return map;
}

export async function saveContact(
  contact: EnrichedContact,
  outputDir: string
): Promise<void> {
  await ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, CONTACTS_FILE);
  const exists = await fileExists(filePath);

  const writer = createObjectCsvWriter({
    path: filePath,
    header: CONTACT_HEADERS,
    append: exists,
  });

  await writer.writeRecords([
    {
      sourceId: contact.sourceId,
      orgName: contact.orgName,
      location: contact.location,
      type: contact.type,
      email: contact.email,
      phone: contact.phone,
      facebook: contact.facebook,
      linkedinPeople: JSON.stringify(contact.linkedinPeople ?? []),
      website: contact.website,
      notes: contact.notes,
      enrichedAt: contact.enrichedAt,
      contactFound: contact.contactFound,
    },
  ]);
}

export function getOutputPaths(outputDir: string): {
  events: string;
  contacts: string;
  jobsState: string;
} {
  return {
    events: path.join(outputDir, EVENTS_FILE),
    contacts: path.join(outputDir, CONTACTS_FILE),
    jobsState: path.join(outputDir, 'jobs-state.json'),
  };
}

export async function saveDebugResponse(
  outputDir: string,
  jobId: string,
  raw: string
): Promise<string> {
  await ensureOutputDir(outputDir);
  const timestamp = Date.now();
  const filePath = path.join(outputDir, `debug-${jobId}-${timestamp}.txt`);
  await fs.writeFile(filePath, raw, 'utf-8');
  return filePath;
}
