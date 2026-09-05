export const WILD_DAILY_LIMIT = 20;
export const WILD_INTERVAL_MS = 3_000;
const DAY_MS = 86_400_000;
export function wildDay(now: number) {
  const start =
    Math.floor((now + 8 * 3_600_000) / DAY_MS) * DAY_MS - 8 * 3_600_000;
  return {
    key: new Date(start + 8 * 3_600_000).toISOString().slice(0, 10),
    resetAt: start + DAY_MS,
    expiresAt: start + 3 * DAY_MS,
  };
}
export type WildResources = {
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
};
export function settleWildResources(
  final: WildResources,
  entry: WildResources,
  technicalAbort: boolean,
): WildResources {
  const source = technicalAbort ? entry : final;
  if (
    ![source.hp, source.mp, entry.maxHp, entry.maxMp].every(Number.isFinite) ||
    entry.maxHp < 1 ||
    entry.maxMp < 0
  )
    throw new Error('INVALID_WILD_SETTLEMENT');
  return {
    hp: Math.max(
      technicalAbort ? 0 : 1,
      Math.min(entry.maxHp, Math.floor(source.hp)),
    ),
    mp: Math.max(0, Math.min(entry.maxMp, Math.floor(source.mp))),
    maxHp: entry.maxHp,
    maxMp: entry.maxMp,
  };
}
