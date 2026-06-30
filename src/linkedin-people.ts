import { LinkedInPerson } from './types';

export function parseLinkedinPeopleJson(raw: string | undefined): LinkedInPerson[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const p = entry as Record<string, unknown>;
        return {
          name: String(p?.name ?? '').trim(),
          location: String(p?.location ?? '').trim(),
          role: String(p?.role ?? '').trim(),
        };
      })
      .filter((p) => p.name);
  } catch {
    return [];
  }
}

export function normalizeLinkedinPeople(raw: unknown): LinkedInPerson[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const p = entry as Record<string, unknown>;
      return {
        name: String(p?.name ?? '').trim(),
        location: String(p?.location ?? '').trim(),
        role: String(p?.role ?? '').trim(),
      };
    })
    .filter((p) => p.name);
}
