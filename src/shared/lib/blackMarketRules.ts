import type { BlackMarketRevealRating } from '@shared/types/blackMarket';

export const BLACK_MARKET_MAX_INSPECTIONS = 3;
export const BLACK_MARKET_MAX_TURNS = 6;
export const BLACK_MARKET_ENTRY_COST = 5;
export const BLACK_MARKET_QUALITIES = [
  '地品',
  '天品',
  '仙品',
  '神品',
] as const;

const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function blackMarketDayKey(now = Date.now()): string {
  return new Date(now + CHINA_TIME_OFFSET_MS).toISOString().slice(0, 10);
}

export function blackMarketDayEnd(now = Date.now()): number {
  return (
    Math.floor((now + CHINA_TIME_OFFSET_MS) / DAY_MS) * DAY_MS +
    DAY_MS -
    CHINA_TIME_OFFSET_MS
  );
}

export function blackMarketEntryCost(usedEntries: number): 0 | 5 {
  return Math.max(0, Math.floor(usedEntries)) === 0
    ? 0
    : BLACK_MARKET_ENTRY_COST;
}

export function blackMarketEntryId(input: {
  dayKey: string;
  nodeId: string;
  npcId: string;
}): string {
  return `${input.dayKey}:${input.nodeId}:${input.npcId}`;
}

export function blackMarketTurnsRemaining(turnsUsed: number): number {
  return Math.max(
    0,
    BLACK_MARKET_MAX_TURNS - Math.max(0, Math.floor(turnsUsed)),
  );
}

/**
 * Stable, platform-independent unit interval value. The server must feed this
 * with a secret-derived seed; the value itself is deliberately pure for tests.
 */
export function blackMarketUnit(seed: string, label: string): number {
  let hash = 2166136261;
  const input = `${seed}:${label}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function classifyBlackMarketReveal(
  paidPrice: number,
  trueValue: number,
): { valueRatio: number; rating: BlackMarketRevealRating } {
  const valueRatio = trueValue / Math.max(1, paidPrice);
  const paidToValue = paidPrice / Math.max(1, trueValue);
  const rating: BlackMarketRevealRating =
    paidToValue >= 1.55
      ? '血亏'
      : paidToValue >= 1.12
        ? '小亏'
        : paidToValue >= 0.9
          ? '公允'
          : paidToValue >= 0.74
            ? '小赚'
            : paidToValue >= 0.58
              ? '捡漏'
              : '天降横财';
  return { valueRatio, rating };
}
