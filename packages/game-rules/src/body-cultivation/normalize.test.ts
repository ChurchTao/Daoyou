import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  CultivatorCondition,
} from '@daoyou/game-domain/condition';
import { describe, expect, it } from 'vitest';
import { normalizeBodyCultivationState } from './normalize.js';
import { getBodyCultivationSummary } from './summary.js';

function createCondition(): CultivatorCondition {
  return {
    version: 1,
    resources: { hp: { current: 100 }, mp: { current: 100 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: { level: 1, progress: 10 },
        spirit: { level: 2, progress: 20 },
        wisdom: { level: 3, progress: 30 },
        speed: { level: 4, progress: 40 },
        willpower: { level: 5, progress: 50 },
      },
      marrowWash: { level: 0, progress: 0 },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
  };
}

function setBodyState(
  condition: CultivatorCondition,
  realm: BodyCultivationRealm,
  levels: Record<BodyCultivationTrackKey, number>,
): void {
  condition.tracks.bodyCultivation = {
    version: 1,
    realm,
    tracks: {
      skin: { level: levels.skin, progress: 11 },
      sinew_bone: { level: levels.sinew_bone, progress: 12 },
      organs: { level: levels.organs, progress: 13 },
      qi_blood: { level: levels.qi_blood, progress: 14 },
      primordial_spirit: { level: levels.primordial_spirit, progress: 15 },
    },
    milestones: { legacy: true },
    breakthrough: {
      targetRealm: 'bronze_skin',
      progress: 68,
      failedAttempts: 2,
    },
  };
}

describe('body cultivation normalization and advancement', () => {
  it('lazily maps legacy tempering tracks into body cultivation tracks', () => {
    const state = normalizeBodyCultivationState(createCondition());

    expect(state.tracks.qi_blood).toEqual({ level: 1, progress: 10 });
    expect(state.tracks.organs).toEqual({ level: 2, progress: 20 });
    expect(state.tracks.primordial_spirit).toEqual({ level: 3, progress: 30 });
    expect(state.tracks.skin).toEqual({ level: 4, progress: 40 });
    expect(state.tracks.sinew_bone).toEqual({ level: 5, progress: 50 });
  });

  it('derives titles from total levels regardless of persisted title or cultivation realm', () => {
    const condition = createCondition();
    setBodyState(condition, 'mortal_body', {
      skin: 10,
      sinew_bone: 10,
      organs: 10,
      qi_blood: 10,
      primordial_spirit: 15,
    });
    const before = structuredClone(condition);
    expect(normalizeBodyCultivationState(condition).realm).toBe('jade_marrow');
    expect(
      normalizeBodyCultivationState(condition).breakthrough,
    ).toBeUndefined();
    expect(
      getBodyCultivationSummary(condition, { cultivatorRealm: '炼气' }),
    ).toMatchObject({
      realm: { key: 'jade_marrow' },
      totalLevel: 55,
      trackLevelCap: 10,
    });
    expect(
      getBodyCultivationSummary(condition, { cultivatorRealm: '合体' })
        .trackLevelCap,
    ).toBe(60);
    expect(condition).toEqual(before);
  });
});
