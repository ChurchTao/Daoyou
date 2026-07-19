const SECT_TIMEZONE = 'Asia/Shanghai';

export function getSectDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getSectWeekKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const local = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    values.weekday,
  );
  local.setUTCDate(local.getUTCDate() - ((weekday + 6) % 7));
  return local.toISOString().slice(0, 10);
}

export function getSectBountyMode(weekKey = getSectWeekKey()): 'battle' | 'material' {
  const seed = [...weekKey].reduce(
    (sum, char) => sum * 31 + char.charCodeAt(0),
    0,
  );
  return Math.abs(seed) % 2 === 0 ? 'battle' : 'material';
}
