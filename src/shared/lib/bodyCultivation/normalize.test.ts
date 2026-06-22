import { describe, expect, it } from 'vitest';
import {
  breakthroughBodyCultivationRealm,
  previewBodyCultivationRealmBreakthrough,
} from './breakthrough';
import { normalizeBodyCultivationState } from './normalize';
import { getBodyCultivationSummary } from './summary';
import type { CultivatorCondition } from '@shared/types/condition';

function createLegacyCondition(): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: { current: 100 },
      mp: { current: 100 },
    },
    gauges: {
      pillToxicity: 0,
    },
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

describe('normalizeBodyCultivationState', () => {
  it('lazily maps legacy tempering tracks into the new body cultivation tracks', () => {
    const state = normalizeBodyCultivationState(createLegacyCondition());

    expect(state.tracks.qi_blood).toEqual({ level: 1, progress: 10 });
    expect(state.tracks.organs).toEqual({ level: 2, progress: 20 });
    expect(state.tracks.primordial_spirit).toEqual({
      level: 3,
      progress: 30,
    });
    expect(state.tracks.skin).toEqual({ level: 4, progress: 40 });
    expect(state.tracks.sinew_bone).toEqual({ level: 5, progress: 50 });
  });

  it('summarizes the next body realm breakthrough requirements', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'mortal_body',
      tracks: {
        skin: { level: 3, progress: 0 },
        sinew_bone: { level: 3, progress: 0 },
        organs: { level: 3, progress: 0 },
        qi_blood: { level: 3, progress: 0 },
        primordial_spirit: { level: 0, progress: 0 },
      },
      milestones: {},
    };

    const summary = getBodyCultivationSummary(condition, {
      cultivatorRealm: '炼气',
    });

    expect(summary.realm.label).toBe('凡躯');
    expect(summary.totalLevel).toBe(12);
    expect(summary.nextRealm).toMatchObject({
      key: 'bronze_skin',
      label: '铜皮',
      canAttempt: true,
    });
  });

  it('reports unmet requirements for higher body realms', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'bronze_skin',
      tracks: {
        skin: { level: 5, progress: 0 },
        sinew_bone: { level: 8, progress: 0 },
        organs: { level: 7, progress: 0 },
        qi_blood: { level: 5, progress: 0 },
        primordial_spirit: { level: 5, progress: 0 },
      },
      milestones: {},
    };

    const summary = getBodyCultivationSummary(condition, {
      cultivatorRealm: '炼气',
    });

    expect(summary.nextRealm?.key).toBe('iron_bone');
    expect(summary.nextRealm?.canAttempt).toBe(false);
    expect(summary.nextRealm?.requirements).toEqual(
      expect.arrayContaining([
        { label: '修为境界达到筑基', met: false },
        { label: '皮肤 Lv.5/6', met: false },
      ]),
    );
  });

  it('previews and advances body realm breakthrough when requirements are met', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'mortal_body',
      tracks: {
        skin: { level: 4, progress: 0 },
        sinew_bone: { level: 4, progress: 0 },
        organs: { level: 4, progress: 0 },
        qi_blood: { level: 0, progress: 0 },
        primordial_spirit: { level: 0, progress: 0 },
      },
      milestones: {},
    };

    const preview = previewBodyCultivationRealmBreakthrough(condition, {
      cultivatorRealm: '炼气',
    });
    const result = breakthroughBodyCultivationRealm(condition, {
      cultivatorRealm: '炼气',
    }, () => 0);

    expect(preview).toMatchObject({
      currentRealm: 'mortal_body',
      nextRealm: 'bronze_skin',
      canAttempt: true,
      successChance: 0.82,
      guaranteeProgress: 0,
      failedAttempts: 0,
      costs: [
        {
          type: 'material',
          name: '破限资材（特殊辅料，玄品以上）',
          label: '破限资材（特殊辅料，玄品以上）',
          quantity: 1,
          materialType: 'aux',
          minQuality: '玄品',
        },
        {
          type: 'consumable',
          name: '炼体·皮肤破限丹（玄品以上）',
          label: '炼体·皮肤破限丹（玄品以上）',
          quantity: 1,
          family: 'tempering',
          property: 'body_skin',
          minQuality: '玄品',
        },
      ],
    });
    expect(result.fromRealm).toBe('mortal_body');
    expect(result.toRealm).toBe('bronze_skin');
    expect(result.success).toBe(true);
    expect(result.chance).toBe(0.82);
    expect(result.roll).toBe(0);
    expect(result.state.realm).toBe('bronze_skin');
    expect(result.state.milestones['realm.bronze_skin']).toBe(true);
    expect(result.state.breakthrough).toBeUndefined();
  });

  it('records failed body realm breakthrough attempts without advancing realm', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'mortal_body',
      tracks: {
        skin: { level: 4, progress: 0 },
        sinew_bone: { level: 4, progress: 0 },
        organs: { level: 4, progress: 0 },
        qi_blood: { level: 0, progress: 0 },
        primordial_spirit: { level: 0, progress: 0 },
      },
      milestones: {},
    };

    const result = breakthroughBodyCultivationRealm(condition, {
      cultivatorRealm: '炼气',
    }, () => 0.99);

    expect(result).toMatchObject({
      fromRealm: 'mortal_body',
      toRealm: 'bronze_skin',
      success: false,
      chance: 0.82,
      roll: 0.99,
      failedAttempts: 1,
      guaranteeProgress: 34,
    });
    expect(result.state.realm).toBe('mortal_body');
    expect(result.state.breakthrough).toEqual({
      targetRealm: 'bronze_skin',
      progress: 34,
      failedAttempts: 1,
    });
  });

  it('uses failed attempts and guarantee progress when previewing body breakthrough', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'mortal_body',
      tracks: {
        skin: { level: 4, progress: 0 },
        sinew_bone: { level: 4, progress: 0 },
        organs: { level: 4, progress: 0 },
        qi_blood: { level: 0, progress: 0 },
        primordial_spirit: { level: 0, progress: 0 },
      },
      milestones: {},
      breakthrough: {
        targetRealm: 'bronze_skin',
        progress: 68,
        failedAttempts: 2,
      },
    };

    const preview = previewBodyCultivationRealmBreakthrough(condition, {
      cultivatorRealm: '炼气',
    });

    expect(preview.successChance).toBeCloseTo(0.98, 5);
    expect(preview.guaranteeProgress).toBe(68);
    expect(preview.failedAttempts).toBe(2);
  });

  it('guarantees body breakthrough once progress reaches full', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'mortal_body',
      tracks: {
        skin: { level: 4, progress: 0 },
        sinew_bone: { level: 4, progress: 0 },
        organs: { level: 4, progress: 0 },
        qi_blood: { level: 0, progress: 0 },
        primordial_spirit: { level: 0, progress: 0 },
      },
      milestones: {},
      breakthrough: {
        targetRealm: 'bronze_skin',
        progress: 100,
        failedAttempts: 3,
      },
    };

    const result = breakthroughBodyCultivationRealm(condition, {
      cultivatorRealm: '炼气',
    }, () => 0.9999);

    expect(result.success).toBe(true);
    expect(result.chance).toBe(1);
    expect(result.state.realm).toBe('bronze_skin');
    expect(result.state.breakthrough).toBeUndefined();
  });

  it('rejects body realm breakthrough without mutating the input state', () => {
    const condition = createLegacyCondition();
    condition.tracks.bodyCultivation = {
      version: 1,
      realm: 'bronze_skin',
      tracks: {
        skin: { level: 5, progress: 0 },
        sinew_bone: { level: 8, progress: 0 },
        organs: { level: 7, progress: 0 },
        qi_blood: { level: 5, progress: 0 },
        primordial_spirit: { level: 5, progress: 0 },
      },
      milestones: {},
    };

    expect(() =>
      breakthroughBodyCultivationRealm(condition, {
        cultivatorRealm: '炼气',
      }),
    ).toThrow('肉身破限条件不足');
    expect(condition.tracks.bodyCultivation.realm).toBe('bronze_skin');
    expect(condition.tracks.bodyCultivation.milestones).toEqual({});
  });
});
