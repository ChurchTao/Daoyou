import { describe, expect, it } from 'vitest';
import {
  breakthroughBodyCultivationRealm,
  previewBodyCultivationRealmBreakthrough,
} from './breakthrough';
import { normalizeBodyCultivationState } from './normalize';
import { getBodyCultivationSummary } from './summary';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  CultivatorCondition,
} from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';

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

  it('only checks cultivation realm and total five-track level', () => {
    const condition = createCondition();
    setBodyState(condition, 'bronze_skin', {
      skin: 0,
      sinew_bone: 0,
      organs: 0,
      qi_blood: 0,
      primordial_spirit: 30,
    });

    const ready = getBodyCultivationSummary(condition, {
      cultivatorRealm: '筑基',
    });
    const blocked = getBodyCultivationSummary(condition, {
      cultivatorRealm: '炼气',
    });

    expect(ready.nextRealm).toMatchObject({
      key: 'iron_bone',
      canAttempt: true,
      requirements: [
        { label: '总炼体 Lv.30/30', met: true },
        { label: '修为境界达到筑基', met: true },
      ],
    });
    expect(blocked.nextRealm?.canAttempt).toBe(false);
  });

  it('advances deterministically one realm and preserves tracks and milestones', () => {
    const condition = createCondition();
    setBodyState(condition, 'mortal_body', {
      skin: 12,
      sinew_bone: 0,
      organs: 0,
      qi_blood: 0,
      primordial_spirit: 0,
    });
    const before = structuredClone(condition);
    const preview = previewBodyCultivationRealmBreakthrough(condition, {
      cultivatorRealm: '炼气',
    });
    const result = breakthroughBodyCultivationRealm(condition, {
      cultivatorRealm: '炼气',
    });

    expect(preview).toMatchObject({
      currentRealm: 'mortal_body',
      nextRealm: 'bronze_skin',
      canAdvance: true,
      totalLevel: 12,
      requiredTotalLevel: 12,
      requiredCultivationRealm: '炼气',
    });
    expect(result).toMatchObject({
      fromRealm: 'mortal_body',
      toRealm: 'bronze_skin',
      state: {
        realm: 'bronze_skin',
        milestones: { legacy: true },
        tracks: before.tracks.bodyCultivation!.tracks,
      },
    });
    expect(result.state.breakthrough).toBeUndefined();
    expect(condition).toEqual(before);
  });

  it.each([
    ['mortal_body', '炼气', 12, 'bronze_skin'],
    ['bronze_skin', '筑基', 30, 'iron_bone'],
    ['iron_bone', '金丹', 55, 'jade_marrow'],
    ['jade_marrow', '元婴', 90, 'golden_body'],
    ['golden_body', '化神', 140, 'dharma_body'],
    ['dharma_body', '合体', 220, 'dao_body'],
  ] as const)(
    'advances %s at the locked realm and total-level threshold',
    (fromRealm, cultivatorRealm, totalLevel, toRealm) => {
      const condition = createCondition();
      setBodyState(condition, fromRealm, {
        skin: totalLevel,
        sinew_bone: 0,
        organs: 0,
        qi_blood: 0,
        primordial_spirit: 0,
      });

      expect(
        breakthroughBodyCultivationRealm(condition, { cultivatorRealm }).toRealm,
      ).toBe(toRealm);
    },
  );

  it('rejects unmet conditions and the maximum realm without mutation', () => {
    const condition = createCondition();
    setBodyState(condition, 'bronze_skin', {
      skin: 30,
      sinew_bone: 0,
      organs: 0,
      qi_blood: 0,
      primordial_spirit: 0,
    });
    const before = structuredClone(condition);

    expect(() =>
      breakthroughBodyCultivationRealm(condition, {
        cultivatorRealm: '炼气',
      }),
    ).toThrow('肉身进阶条件不足');
    expect(condition).toEqual(before);

    condition.tracks.bodyCultivation!.realm = 'dao_body';
    expect(() =>
      breakthroughBodyCultivationRealm(condition, {
        cultivatorRealm: '渡劫' as RealmType,
      }),
    ).toThrow('肉身已达最高阶位');
  });
});
