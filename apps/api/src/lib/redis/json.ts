export function parseRedisJson<T>(raw: string | null, label: string): T | null {
  if (raw == null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse Redis JSON for ${label}:`, error);
    return null;
  }
}
