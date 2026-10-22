import type { RealmType } from '@daoyou/constants/realms';
import type { ConditionProgressTrack } from '@daoyou/game-domain/condition';
import { getBodyCultivationLevelCapByCultivationRealm } from './config.js';
import { bodyCultivationThreshold } from './threshold.js';

export function advanceProgressTrack<T extends ConditionProgressTrack>(
  input: T,
  value: number,
  cap: number,
  thresholdByLevel: (level: number) => number,
): { state: T; levelUps: number[]; unusedProgress: number } {
  const state = { ...input };
  let remaining = Math.max(0, Math.floor(value));
  const levelUps: number[] = [];
  while (remaining > 0 && state.level < cap) {
    const needed = Math.max(0, thresholdByLevel(state.level) - state.progress);
    if (remaining < needed) {
      state.progress += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    state.level += 1;
    state.progress = 0;
    levelUps.push(state.level);
  }
  if (state.level >= cap) state.progress = 0;
  return { state, levelUps, unusedProgress: remaining };
}

export function advanceBodyCultivationTrack(
  input: ConditionProgressTrack,
  value: number,
  realm: RealmType,
) {
  return advanceProgressTrack(
    input,
    value,
    getBodyCultivationLevelCapByCultivationRealm(realm),
    bodyCultivationThreshold,
  );
}
