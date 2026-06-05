import type { TowerSeasonMeta } from './types';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toShanghaiLocalDate(now: Date) {
  return new Date(now.getTime() + SHANGHAI_OFFSET_MS);
}

function fromShanghaiLocalMs(localMs: number) {
  return localMs - SHANGHAI_OFFSET_MS;
}

function buildIsoWeekKey(localDate: Date) {
  const date = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
    ),
  );
  const dayIndex = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayIndex + 3);

  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3);

  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${weekYear}-W${String(week).padStart(2, '0')}@Asia/Shanghai`;
}

export function getTowerSeasonMeta(now: Date = new Date()): TowerSeasonMeta {
  const localDate = toShanghaiLocalDate(now);
  const localDay = (localDate.getUTCDay() + 6) % 7;
  const seasonStartLocalMs =
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ) -
    localDay * 24 * 60 * 60 * 1000;
  const seasonEndLocalMs = seasonStartLocalMs + WEEK_MS;

  return {
    seasonKey: buildIsoWeekKey(new Date(seasonStartLocalMs)),
    seasonStartedAt: new Date(fromShanghaiLocalMs(seasonStartLocalMs)).toISOString(),
    seasonEndsAt: new Date(fromShanghaiLocalMs(seasonEndLocalMs)).toISOString(),
    nextResetAt: new Date(fromShanghaiLocalMs(seasonEndLocalMs)).toISOString(),
  };
}

export function getNextTowerSeasonMeta(now: Date = new Date()): TowerSeasonMeta {
  const current = getTowerSeasonMeta(now);
  return getTowerSeasonMeta(new Date(Date.parse(current.seasonEndsAt) + 1));
}

export function isTowerSeasonKeyCurrent(
  seasonKey: string,
  now: Date = new Date(),
) {
  return seasonKey === getTowerSeasonMeta(now).seasonKey;
}
