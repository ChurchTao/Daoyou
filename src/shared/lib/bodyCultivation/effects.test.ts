import { describe, expect, it } from 'vitest';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import {
  getBodyCultivationBattleInitHooks,
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
    const damageReductionEffect = skinBuff?.listeners?.[0]?.effects?.find(
      (effect) => effect.type === 'percent_damage_modifier',
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
    expect(damageReductionEffect?.params.value).toBeCloseTo(0.072);
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

  it('opens bronze-skin guard for the first three rounds', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'mortal_body',
        }),
      ).startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_bronze_skin_guard',
      ),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'bronze_skin',
      }),
    );
    const guard = hooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_bronze_skin_guard',
    );

    expect(guard).toMatchObject({
      name: '铜皮·护体',
      duration: 3,
      listeners: [
        expect.objectContaining({
          eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
          effects: [
            expect.objectContaining({
              type: 'percent_damage_modifier',
              params: {
                mode: 'reduce',
                value: 0.1,
                cap: 0.1,
              },
            }),
          ],
        }),
      ],
    });
  });

  it('opens iron-bone crit modifiers as a permanent battle buff', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'bronze_skin',
        }),
      ).startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_iron_bone_crit',
      ),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'iron_bone',
      }),
    );

    expect(
      hooks.startingBuffs.find(
        (buff) => buff.id === 'body_cultivation_iron_bone_crit',
      ),
    ).toMatchObject({
      name: '铁骨·战骨',
      duration: -1,
      modifiers: [
        {
          attrType: AttributeType.CRIT_RATE,
          type: ModifierType.FIXED,
          value: 0.08,
        },
        {
          attrType: AttributeType.CRIT_DAMAGE_MULT,
          type: ModifierType.FIXED,
          value: 0.16,
        },
      ],
    });
  });

  it('opens golden-body burn-blood with an immediate hp recovery', () => {
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
              type: 'heal',
              params: {
                value: { targetMaxHpRatio: 0.15 },
              },
            }),
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

  it('opens jade-marrow death prevention and debuff dispel', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'iron_bone',
        }),
      ).startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_jade_marrow_death_prevent',
      ),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'jade_marrow',
      }),
    );
    const jadeBuff = hooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_jade_marrow_death_prevent',
    );

    expect(jadeBuff).toMatchObject({
      name: '玉髓·不灭骨',
      listeners: [
        expect.objectContaining({
          eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
          effects: [
            {
              type: 'death_prevent',
              params: {},
            },
            {
              type: 'dispel',
              conditions: [
                {
                  type: 'is_lethal',
                  params: {},
                },
                {
                  type: 'debuff_count_at_least',
                  params: { value: 1 },
                },
              ],
              params: {
                targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
                maxCount: 99,
              },
            },
          ],
        }),
      ],
    });
  });

  it('opens dharma-body control resistance for the first two rounds', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'golden_body',
        }),
      ).startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_dharma_body_control_resistance',
      ),
    ).toBe(false);

    const dharmaHooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'dharma_body',
      }),
    );
    const daoHooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'dao_body',
      }),
    );
    const dharmaBuff = dharmaHooks.startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_dharma_body_control_resistance',
    );

    expect(dharmaBuff).toMatchObject({
      name: '法身·神识定境',
      duration: 2,
      modifiers: [
        {
          attrType: AttributeType.CONTROL_RESISTANCE,
          type: ModifierType.FIXED,
          value: 1,
        },
      ],
    });
    expect(
      daoHooks.startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_dharma_body_control_resistance',
      ),
    ).toBe(true);
  });

  it('opens dao-body direct damage reduction as a permanent battle buff', () => {
    expect(
      getBodyCultivationBattleInitHooks(
        createCondition({
          realm: 'dharma_body',
        }),
      ).startingBuffs.some(
        (buff) => buff.id === 'body_cultivation_dao_body_damage_reduction',
      ),
    ).toBe(false);

    const hooks = getBodyCultivationBattleInitHooks(
      createCondition({
        realm: 'dao_body',
      }),
    );

    expect(
      hooks.startingBuffs.find(
        (buff) => buff.id === 'body_cultivation_dao_body_damage_reduction',
      ),
    ).toMatchObject({
      name: '道体·万劫不坏',
      duration: -1,
      listeners: [
        expect.objectContaining({
          eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
          effects: [
            expect.objectContaining({
              type: 'percent_damage_modifier',
              params: {
                mode: 'reduce',
                value: 0.2,
                cap: 0.2,
              },
            }),
          ],
        }),
      ],
    });
  });
});
