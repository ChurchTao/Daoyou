import { describe, expect, it } from 'vitest';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  getBodyCultivationBattleInitHooks,
  getBodyCultivationBattleSettleHooks,
  getBodyCultivationBreakthroughPressureHooks,
  getBodyCultivationDungeonEventFeedback,
} from './effects';
import { GameplayTags } from '@shared/engine/shared/tag-domain';

function createCondition(args: {
  realm: CultivatorCondition['tracks']['bodyCultivation']['realm'];
  skin?: number;
  sinewBone?: number;
  organs?: number;
  qiBlood?: number;
  primordialSpirit?: number;
}): CultivatorCondition {
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
      bodyCultivation: {
        version: 1,
        realm: args.realm,
        tracks: {
          skin: { level: args.skin ?? 0, progress: 0 },
          sinew_bone: { level: args.sinewBone ?? 0, progress: 0 },
          organs: { level: args.organs ?? 0, progress: 0 },
          qi_blood: { level: args.qiBlood ?? 0, progress: 0 },
          primordial_spirit: { level: args.primordialSpirit ?? 0, progress: 0 },
        },
        milestones: {},
      },
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
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

describe('body cultivation dungeon event feedback', () => {
  it('maps dungeon erosion text to skin feedback', () => {
    expect(
      getBodyCultivationDungeonEventFeedback({
        contextText: '毒瘴雾气侵蚀皮膜，寒煞沿经络渗入。',
        resource: 'hp',
        preventedLoss: 18,
      }),
    ).toEqual({
      eventType: 'erosion',
      track: 'skin',
      trackLabel: '皮肤',
      triggerText: '皮肤生效：降低外邪侵蚀，已抵消 18 点气血损耗',
    });
  });

  it('maps dungeon illusion text to primordial-spirit feedback', () => {
    expect(
      getBodyCultivationDungeonEventFeedback({
        contextText: '幻境牵动识海，似有残魂试图夺舍。',
        resource: 'mp',
        preventedLoss: 9,
      }),
    ).toEqual({
      eventType: 'spirit_intrusion',
      track: 'primordial_spirit',
      trackLabel: '元神',
      triggerText: '元神生效：降低神魂侵蚀，已抵消 9 点灵力损耗',
    });
  });

  it('keeps existing generic trigger text when no event keyword is present', () => {
    expect(
      getBodyCultivationDungeonEventFeedback({
        contextText: '普通禁制抽走部分灵力。',
        resource: 'mp',
        preventedLoss: 7,
        fallbackTriggerText: '肉身炼体生效：气血与元神稳住灵力损耗 7 点',
      }),
    ).toEqual({
      eventType: 'generic',
      track: 'primordial_spirit',
      trackLabel: '元神',
      triggerText: '肉身炼体生效：气血与元神稳住灵力损耗 7 点',
    });
  });
});

describe('body cultivation battle init hooks', () => {
  it('adds skin direct-damage reduction as a battle-init listener', () => {
    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'bronze_skin',
        skin: 12,
      }),
    );

    const skinBuff = hooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_skin_damage_reduction',
    );

    expect(skinBuff).toMatchObject({
      name: '皮肤·外膜护体',
      listeners: [
        expect.objectContaining({
          eventType: 'DamageRequestEvent',
          effects: [
            expect.objectContaining({
              type: 'percent_damage_modifier',
              params: expect.objectContaining({
                mode: 'reduce',
                cap: 0.45,
              }),
            }),
          ],
        }),
      ],
    });
    expect(
      skinBuff?.listeners?.[0]?.effects[0]?.params.value,
    ).toBeCloseTo(0.072);
  });

  it('adds skin erosion duration reduction as a battle-init listener', () => {
    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'bronze_skin',
        skin: 12,
      }),
    );

    expect(hooks.startingBuffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'body_cultivation_skin_erosion_duration',
          name: '皮肤·铁膜抗蚀',
          listeners: [
            expect.objectContaining({
              eventType: 'BuffAddEvent',
              effects: [
                {
                  type: 'buff_duration_modify',
                  params: {
                    rounds: -2,
                    tags: [
                      GameplayTags.STATUS.STATE.POISONED,
                      GameplayTags.BUFF.DOT.POISON,
                      GameplayTags.BUFF.ELEMENT.POISON,
                    ],
                  },
                },
              ],
            }),
          ],
        }),
      ]),
    );
  });

  it('adds organs high-cost skill refund as a battle-init listener', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'mortal_body',
          organs: 4,
        }),
      ).startingBuffs.some((buff) => buff.id === 'body_cultivation_organs_skill_refund'),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'mortal_body',
        organs: 10,
      }),
    );
    const refundBuff = hooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_organs_skill_refund',
    );

    expect(refundBuff).toMatchObject({
      name: '脏腑·五气回流',
      listeners: [
        expect.objectContaining({
          eventType: 'SkillPreCastEvent',
          effects: [
            expect.objectContaining({
              type: 'heal',
              params: {
                target: 'mp',
                value: { targetMaxMpRatio: 0.12 },
              },
            }),
            expect.objectContaining({
              type: 'apply_buff',
              params: expect.objectContaining({
                buffConfig: expect.objectContaining({
                  id: 'body_cultivation_organs_skill_refund_marker',
                  statusTags: [
                    GameplayTags.STATUS.STATE.BODY_ORGANS_SKILL_REFUNDED,
                  ],
                }),
              }),
            }),
          ],
        }),
      ],
    });
  });

  it('opens golden-body burn-blood only when realm and all tracks are ready', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'jade_marrow',
          skin: 10,
          sinewBone: 10,
          organs: 10,
          qiBlood: 10,
          primordialSpirit: 10,
        }),
      ).startingBuffs.some((buff) => buff.id === 'body_cultivation_golden_body_burn_blood'),
    ).toBe(false);

    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'golden_body',
          skin: 10,
          sinewBone: 10,
          organs: 10,
          qiBlood: 10,
          primordialSpirit: 9,
        }),
      ).startingBuffs.some((buff) => buff.id === 'body_cultivation_golden_body_burn_blood'),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'golden_body',
        skin: 10,
        sinewBone: 10,
        organs: 15,
        qiBlood: 10,
        primordialSpirit: 10,
      }),
    );

    const burnBlood = hooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_golden_body_burn_blood',
    );
    expect(burnBlood).toMatchObject({
      name: '金身·燃血爆发',
      listeners: [
        expect.objectContaining({
          eventType: 'DamageTakenEvent',
          effects: [
            expect.objectContaining({
              type: 'apply_buff',
              params: expect.objectContaining({
                buffConfig: expect.objectContaining({
                  id: 'body_cultivation_golden_body_burn_blood_active',
                  duration: 3,
                }),
              }),
            }),
            expect.objectContaining({
              type: 'apply_buff',
              params: expect.objectContaining({
                buffConfig: expect.objectContaining({
                  id: 'body_cultivation_golden_body_burn_blood_marker',
                  duration: -1,
                  statusTags: [
                    GameplayTags.STATUS.STATE.BODY_BURN_BLOOD_TRIGGERED,
                  ],
                }),
              }),
            }),
          ],
        }),
      ],
    });
  });
});

describe('body cultivation battle settle hooks', () => {
  it('opens jade-marrow defeat protection only when the carrying tracks are ready', () => {
    expect(
      getBodyCultivationBattleSettleHooks(
        createCondition({
          realm: 'iron_bone',
          sinewBone: 12,
          qiBlood: 10,
        }),
      ).defeatProtection,
    ).toBeNull();

    expect(
      getBodyCultivationBattleSettleHooks(
        createCondition({
          realm: 'jade_marrow',
          sinewBone: 11,
          qiBlood: 10,
        }),
      ).defeatProtection,
    ).toBeNull();

    expect(
      getBodyCultivationBattleSettleHooks(
        createCondition({
          realm: 'jade_marrow',
          sinewBone: 12,
          qiBlood: 10,
        }),
      ).defeatProtection,
    ).toEqual({
      hpFloor: 1,
      woundStatus: 'major_wound',
    });
  });
});

describe('body cultivation breakthrough pressure hooks', () => {
  it('adds dao-body pressure carrying on top of track-level mitigation', () => {
    const dharmaBody = getBodyCultivationBreakthroughPressureHooks(
      createCondition({
        realm: 'dharma_body',
        sinewBone: 25,
        qiBlood: 25,
        primordialSpirit: 25,
      }),
    );
    const daoBody = getBodyCultivationBreakthroughPressureHooks(
      createCondition({
        realm: 'dao_body',
        sinewBone: 25,
        qiBlood: 25,
        primordialSpirit: 25,
      }),
    );

    expect(daoBody.expLossMultiplier).toBeLessThan(
      dharmaBody.expLossMultiplier,
    );
    expect(daoBody.insightLossMultiplier).toBeLessThan(
      dharmaBody.insightLossMultiplier,
    );
    expect(daoBody.deviationGainMultiplier).toBeLessThan(
      dharmaBody.deviationGainMultiplier,
    );
    expect(daoBody.innerDemonChanceMultiplier).toBeLessThan(
      dharmaBody.innerDemonChanceMultiplier,
    );
  });
});
