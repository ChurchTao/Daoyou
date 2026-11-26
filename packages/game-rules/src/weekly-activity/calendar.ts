const ACTIVITY_DAY_MS = 24 * 3_600_000;
export const ACTIVITY_WEEK_MS = 7 * ACTIVITY_DAY_MS;
const BEIJING_OFFSET_MS = 8 * 3_600_000;

export function naturalActivityWeek(now: number, offset = 0) {
  const localDay =
    Math.floor((now + BEIJING_OFFSET_MS) / ACTIVITY_DAY_MS) * ACTIVITY_DAY_MS;
  const weekday = (new Date(localDay).getUTCDay() + 6) % 7;
  const monday =
    localDay - weekday * ACTIVITY_DAY_MS + offset * ACTIVITY_WEEK_MS;
  const week = new Date(monday).toISOString().slice(0, 10);
  const opensAt = monday - BEIJING_OFFSET_MS;
  const closesAt = opensAt + ACTIVITY_WEEK_MS;
  return { week, opensAt, closesAt };
}
