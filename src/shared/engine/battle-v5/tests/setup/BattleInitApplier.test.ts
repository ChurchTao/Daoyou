import type { Cultivator } from '@shared/types/cultivator';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import { BuffType, ModifierType, AttributeType } from '../../core/types';
import { StackRule } from '../../buffs/Buff';
import { BuffFactory } from '../../factories/BuffFactory';
import { createBattleUnitsWithInit } from '../../setup/BattleInitApplier';
import { EventBus } from '../../core/EventBus';
import {
  ActionEvent,
  DamageRequestEvent,
  DeathPreventEvent,
  SkillPreCastEvent,
  UnitDeadEvent,
} from '../../core/events';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityId } from '../../core/types';
import { TargetPolicy } from '../../abilities/TargetPolicy';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DamageSystem } from '../../systems/DamageSystem';
import { DamageSource, DamageType } from '../../core/types';
import type { BodyCultivationTrackKey, CultivatorCondition } from '@shared/types/condition';

function createCultivator(id: string, name: string): Cultivator {
  return {
    id,
    name,
    age: 18,
    lifespan: 120,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    spirit_stones: 0,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
  };
}

function createBodyCultivationCondition(
  levels: Partial<Record<BodyCultivationTrackKey, number>>,
  realm: NonNullable<CultivatorCondition['tracks']['bodyCultivation']>['realm'] = 'bronze_skin',
): CultivatorCondition {
  const track = (key: BodyCultivationTrackKey) => ({
    level: levels[key] ?? 0,
    progress: 0,
  });

  return {
    version: 1,
    resources: {
      hp: { current: 360 },
      mp: { current: 260 },
    },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
      marrowWash: { level: 0, progress: 0 },
      bodyCultivation: {
        version: 1,
        realm,
        tracks: {
          skin: track('skin'),
          sinew_bone: track('sinew_bone'),
          organs: track('organs'),
          qi_blood: track('qi_blood'),
          primordial_spirit: track('primordial_spirit'),
        },
        milestones: {},
      },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
    metrics: {
      totalRecoveredHp: 0,
      totalRecoveredMp: 0,
    },
  };
}

class InitHealSkill extends ActiveSkill {
  constructor() {
    super('init_heal_skill' as AbilityId, '初始化治疗', {
      targetPolicy: TargetPolicy.self(),
      priority: 100,
      selectionProfile: { intents: ['heal_hp'] },
    });
    this.tags.addTags([GameplayTags.ABILITY.FUNCTION.HEAL]);
  }
  protected executeSkill(): void {}
}

class InitDamageSkill extends ActiveSkill {
  constructor() {
    super('init_damage_skill' as AbilityId, '初始化伤害', {
      targetPolicy: TargetPolicy.default(),
      priority: 50,
      selectionProfile: { intents: ['damage'] },
    });
    this.tags.addTags([GameplayTags.ABILITY.FUNCTION.DAMAGE]);
  }
  protected executeSkill(): void {}
}

class HighCostSkill extends ActiveSkill {
  constructor(mpCost = 80) {
    super('high_cost_skill' as AbilityId, '高耗神通', {
      mpCost,
      targetPolicy: TargetPolicy.default(),
    });
    this.tags.addTags([GameplayTags.ABILITY.FUNCTION.DAMAGE]);
  }
  protected executeSkill(): void {}
}

describe('BattleInitApplier', () => {
  test('MAX_HP 初始化 modifier 在 buff 触发派生刷新后仍保持有效', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');

    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        opponent: {
          modifiers: [
            {
              attrType: AttributeType.MAX_HP,
              type: ModifierType.OVERRIDE,
              value: 10_000_000,
            },
          ],
          resourceState: {
            hp: { mode: 'absolute', value: 10_000_000 },
          },
        },
      },
    );

    const vitalityBuff = BuffFactory.create({
      id: 'training_vitality_up',
      name: '体魄加成',
      type: BuffType.BUFF,
      duration: 3,
      stackRule: StackRule.REFRESH_DURATION,
      modifiers: [
        {
          attrType: AttributeType.VITALITY,
          type: ModifierType.FIXED,
          value: 20,
        },
      ],
    });

    opponentUnit.buffs.addBuff(vitalityBuff, playerUnit);

    expect(opponentUnit.getMaxHp()).toBe(10_000_000);
    expect(opponentUnit.getCurrentHp()).toBe(10_000_000);
  });

  test('状态模板与资源状态按统一顺序初始化，当前气血基于最终上限结算', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');

    const { opponentUnit } = createBattleUnitsWithInit(player, opponent, {
      opponent: {
        modifiers: [
          {
            attrType: AttributeType.MAX_HP,
            type: ModifierType.FIXED,
            value: 100,
          },
        ],
        statusRefs: [
          {
            version: 1,
            templateId: 'minor_wound',
            stacks: 1,
          },
        ],
        resourceState: {
          hp: { mode: 'percent', value: 0.5 },
        },
      },
    });

    expect(opponentUnit.getMaxHp()).toBe(541);
    expect(opponentUnit.getCurrentHp()).toBe(270);
  });

  test('状态录制中的 maxHp 底座与修正值能正确区分', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');

    const result = simulateBattleV5(player, opponent, {
      opponent: {
        modifiers: [
          {
            attrType: AttributeType.MAX_HP,
            type: ModifierType.OVERRIDE,
            value: 1_000,
          },
        ],
        resourceState: {
          hp: { mode: 'absolute', value: 1_000 },
        },
      },
    });

    const initFrame = result.stateTimeline.frames[0].units.dummy;

    expect(initFrame.baseAttrs.maxHp).toBe(502);
    expect(initFrame.attrs.maxHp).toBe(1_000);
    expect(initFrame.hp.current).toBe(1_000);
  });

  test('resourceState.shield 会设置初始护盾', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');

    const { playerUnit } = createBattleUnitsWithInit(player, opponent, {
      player: {
        resourceState: {
          shield: 180,
        },
      },
    });

    expect(playerUnit.getCurrentShield()).toBe(180);
  });

  test('肉身入场效果会自动挂载到双方战斗单元', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('opponent', '对手');
    player.condition = createBodyCultivationCondition({
      skin: 5,
      organs: 5,
    });
    opponent.condition = createBodyCultivationCondition({
      skin: 5,
    });

    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(player, opponent);

    expect(playerUnit.getCurrentShield()).toBeGreaterThan(0);
    expect(opponentUnit.getCurrentShield()).toBeGreaterThan(0);
    expect(
      playerUnit.buffs
        .getAllBuffs()
        .some((buff) => buff.id === 'body_cultivation_skin_damage_reduction'),
    ).toBe(true);
    expect(
      playerUnit.buffs
        .getAllBuffs()
        .some((buff) => buff.id === 'body_cultivation_organs_skill_refund'),
    ).toBe(true);
  });

  test('肉身入场效果不会覆盖显式护盾或重复同名 buff', () => {
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('opponent', '对手');
    player.condition = createBodyCultivationCondition({
      skin: 5,
    });

    const { playerUnit } = createBattleUnitsWithInit(player, opponent, {
      player: {
        resourceState: {
          shield: 123,
        },
        startingBuffs: [
          {
            source: 'self',
            buff: {
              id: 'body_cultivation_skin_damage_reduction',
              name: '已有皮肤护体',
              type: BuffType.BUFF,
              duration: -1,
              stackRule: 'override',
            },
          },
        ],
      },
    });

    expect(playerUnit.getCurrentShield()).toBe(123);
    expect(
      playerUnit.buffs
        .getAllBuffs()
        .filter((buff) => buff.id === 'body_cultivation_skin_damage_reduction'),
    ).toHaveLength(1);
  });

  test('startingBuffs 中的免死监听器会在致命受击窗口触发', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();
    const damageSystem = new DamageSystem();
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          startingBuffs: [
            {
              source: 'self',
              buff: {
                id: 'test_death_prevent',
                name: '保命',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                    priority: 50,
                    guard: {
                      requireOwnerAlive: false,
                      allowLethalWindow: true,
                      skipReflectSource: true,
                    },
                    effects: [{ type: 'death_prevent', params: {} }],
                  },
                ],
              },
            },
          ],
        },
      },
    );
    let deathEvent: UnitDeadEvent | undefined;
    let deathPreventEvent: DeathPreventEvent | undefined;

    eventBus.subscribe<UnitDeadEvent>('UnitDeadEvent', (event) => {
      deathEvent = event;
    });
    eventBus.subscribe<DeathPreventEvent>('DeathPreventEvent', (event) => {
      deathPreventEvent = event;
    });

    eventBus.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: opponentUnit,
      target: playerUnit,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 1_000_000,
      finalDamage: 1_000_000,
    });

    expect(playerUnit.getCurrentHp()).toBe(1);
    expect(playerUnit.isAlive()).toBe(true);
    expect(deathPreventEvent?.target.id).toBe('player');
    expect(deathEvent).toBeUndefined();

    damageSystem.destroy();
    eventBus.reset();
  });

  test('startingBuffs 中的金身燃血会在低血受击后触发且每场只触发一次', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();
    const damageSystem = new DamageSystem();
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          resourceState: {
            hp: { mode: 'absolute', value: 100 },
          },
          startingBuffs: [
            {
              source: 'self',
              buff: {
                id: 'test_body_burn_blood',
                name: '金身·燃血爆发',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                    priority: 20,
                    guard: {
                      requireOwnerAlive: true,
                      skipReflectSource: true,
                    },
                    effects: [
                      {
                        type: 'apply_buff',
                        conditions: [
                          {
                            type: 'hp_below',
                            params: { value: 0.35, scope: 'target' },
                          },
                          {
                            type: 'has_not_tag',
                            params: {
                              tag: GameplayTags.STATUS.STATE
                                .BODY_BURN_BLOOD_TRIGGERED,
                              scope: 'target',
                            },
                          },
                        ],
                        params: {
                          buffConfig: {
                            id: 'test_body_burn_blood_active',
                            name: '金身·燃血',
                            type: BuffType.BUFF,
                            duration: 3,
                            stackRule: 'override',
                            modifiers: [
                              {
                                attrType: AttributeType.ATK,
                                type: ModifierType.ADD,
                                value: 0.2,
                              },
                            ],
                          },
                        },
                      },
                      {
                        type: 'apply_buff',
                        conditions: [
                          {
                            type: 'hp_below',
                            params: { value: 0.35, scope: 'target' },
                          },
                          {
                            type: 'has_not_tag',
                            params: {
                              tag: GameplayTags.STATUS.STATE
                                .BODY_BURN_BLOOD_TRIGGERED,
                              scope: 'target',
                            },
                          },
                        ],
                        params: {
                          buffConfig: {
                            id: 'test_body_burn_blood_marker',
                            name: '金身·燃血已发',
                            type: BuffType.BUFF,
                            duration: -1,
                            stackRule: 'override',
                            statusTags: [
                              GameplayTags.STATUS.STATE
                                .BODY_BURN_BLOOD_TRIGGERED,
                            ],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    );

    const baseAtk = playerUnit.attributes.getValue(AttributeType.ATK);

    eventBus.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: opponentUnit,
      target: playerUnit,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 80,
      finalDamage: 80,
    });

    const activeBuffs = playerUnit.buffs
      .getAllBuffs()
      .filter((buff) => buff.id === 'test_body_burn_blood_active');

    expect(playerUnit.getCurrentHp()).toBeLessThan(35);
    expect(activeBuffs).toHaveLength(1);
    expect(playerUnit.tags.hasTag(
      GameplayTags.STATUS.STATE.BODY_BURN_BLOOD_TRIGGERED,
    )).toBe(true);
    expect(playerUnit.attributes.getValue(AttributeType.ATK)).toBeCloseTo(
      baseAtk * 1.2,
    );

    playerUnit.buffs.removeBuff('test_body_burn_blood_active');

    eventBus.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: opponentUnit,
      target: playerUnit,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 1,
      finalDamage: 1,
    });

    expect(
      playerUnit.buffs
        .getAllBuffs()
        .some((buff) => buff.id === 'test_body_burn_blood_active'),
    ).toBe(false);

    damageSystem.destroy();
    eventBus.reset();
  });

  test('startingBuffs 中的皮肤外护会写入直接受击减伤桶', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();
    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          startingBuffs: [
            {
              source: 'self',
              buff: {
                id: 'test_skin_damage_reduction',
                name: '皮肤·外膜护体',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
                    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                    priority: 25,
                    guard: {
                      requireOwnerAlive: true,
                      skipReflectSource: true,
                    },
                    effects: [
                      {
                        type: 'percent_damage_modifier',
                        params: {
                          mode: 'reduce',
                          value: 0.2,
                          cap: 0.45,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    );
    const damageRequest: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: opponentUnit,
      target: playerUnit,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    eventBus.publish<DamageRequestEvent>(damageRequest);

    expect(damageRequest.damageReductionPctBucket).toBeCloseTo(0.2);

    eventBus.reset();
  });

  test('startingBuffs 中的皮肤抗蚀会缩短毒类持久状态', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();

    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          startingBuffs: [
            {
              source: 'self',
              buff: {
                id: 'test_skin_erosion_duration',
                name: '皮肤·铁膜抗蚀',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.BUFF_ADD,
                    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                    priority: 20,
                    effects: [
                      {
                        type: 'buff_duration_modify',
                        params: {
                          rounds: -2,
                          tags: [
                            GameplayTags.STATUS.STATE.POISONED,
                            GameplayTags.BUFF.DOT.POISON,
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    );
    const poison = BuffFactory.create({
      id: 'test_poison',
      name: '毒蚀',
      type: BuffType.DEBUFF,
      duration: 5,
      stackRule: 'override',
      tags: [GameplayTags.STATUS.STATE.POISONED],
    });

    playerUnit.buffs.addBuff(poison, opponentUnit);

    expect(
      playerUnit.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'test_poison')
        ?.getDuration(),
    ).toBe(3);
    eventBus.reset();
  });

  test('startingBuffs 中的脏腑返还能在首次高耗技能前恢复法力', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();

    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          resourceState: {
            mp: { mode: 'absolute', value: 100 },
          },
          startingBuffs: [
            {
              source: 'self',
              buff: {
                id: 'test_body_organs_skill_refund',
                name: '脏腑·五气回流',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.SKILL_PRE_CAST,
                    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
                    priority: 15,
                    mapping: {
                      caster: 'owner',
                      target: 'owner',
                    },
                    effects: [
                      {
                        type: 'heal',
                        conditions: [
                          {
                            type: 'ability_mp_cost_at_least',
                            params: { value: 40 },
                          },
                          {
                            type: 'has_not_tag',
                            params: {
                              tag: GameplayTags.STATUS.STATE
                                .BODY_ORGANS_SKILL_REFUNDED,
                              scope: 'caster',
                            },
                          },
                        ],
                        params: {
                          target: 'mp',
                          value: { targetMaxMpRatio: 0.12 },
                        },
                      },
                      {
                        type: 'apply_buff',
                        conditions: [
                          {
                            type: 'ability_mp_cost_at_least',
                            params: { value: 40 },
                          },
                          {
                            type: 'has_not_tag',
                            params: {
                              tag: GameplayTags.STATUS.STATE
                                .BODY_ORGANS_SKILL_REFUNDED,
                              scope: 'caster',
                            },
                          },
                        ],
                        params: {
                          buffConfig: {
                            id: 'test_body_organs_skill_refund_marker',
                            name: '脏腑·五气已回流',
                            type: BuffType.BUFF,
                            duration: -1,
                            stackRule: 'override',
                            statusTags: [
                              GameplayTags.STATUS.STATE
                                .BODY_ORGANS_SKILL_REFUNDED,
                            ],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    );
    const ability = new HighCostSkill(80);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster: playerUnit,
      target: opponentUnit,
      ability,
      isInterrupted: false,
    });

    expect(playerUnit.getCurrentMp()).toBe(
      100 + Math.round(playerUnit.getMaxMp() * 0.12),
    );
    expect(
      playerUnit.tags.hasTag(
        GameplayTags.STATUS.STATE.BODY_ORGANS_SKILL_REFUNDED,
      ),
    ).toBe(true);

    const afterFirstRefund = playerUnit.getCurrentMp();
    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster: playerUnit,
      target: opponentUnit,
      ability,
      isInterrupted: false,
    });

    expect(playerUnit.getCurrentMp()).toBe(afterFirstRefund);
    eventBus.reset();
  });

  test('selectionStrategySettings 会注入玩家技能选择策略', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();

    const player = createCultivator('player', '道友');
    const opponent = createCultivator('dummy', '木桩');
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      {
        player: {
          resourceState: {
            hp: { mode: 'percent', value: 0.65 },
          },
          selectionStrategySettings: {
            version: 1,
            mode: 'conservative',
            healHpSkipThreshold: 0.9,
            emergencyHealHpThreshold: 0.7,
            restoreMpSkipThreshold: 0.75,
            avoidRepeatControl: true,
          },
        },
      },
    );
    playerUnit.abilities.setDefaultTarget(opponentUnit);
    playerUnit.abilities.addAbility(new InitHealSkill());
    playerUnit.abilities.addAbility(new InitDamageSkill());

    let capturedAbilityId: string | null = null;
    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: playerUnit,
    });

    expect(capturedAbilityId).toBe('init_heal_skill');
    eventBus.reset();
  });
});
