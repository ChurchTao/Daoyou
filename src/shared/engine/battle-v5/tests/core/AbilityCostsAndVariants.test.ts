import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DynamicDataDrivenActiveSkill } from '../../abilities/DynamicDataDrivenActiveSkill';
import type { ActiveSkill } from '../../abilities/ActiveSkill';
import { StackRule } from '../../buffs/Buff';
import { TargetPolicy } from '../../abilities/TargetPolicy';
import { EventBus } from '../../core/EventBus';
import { checkConditions } from '../../core/conditionEvaluator';
import { scaleEffectNumericStrength } from '../../core/effectStrengthScaler';
import type {
  AbilityCostPaidEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  HpChangedEvent,
  SkillCastEvent,
  SkillPreCastEvent,
} from '../../core/events';
import {
  beginRuntimeAction,
  readAbilityMode,
  readMemory,
  setAbilityMode,
} from '../../core/runtimeState';
import { AbilityType, AttributeType, BuffType, DamageSource, DamageType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.WISDOM]: 10,
    [AttributeType.SPEED]: 10,
    [AttributeType.WILLPOWER]: 10,
  });
}

describe('气血成本与动态技能变体', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('按施法前当前气血向上取整、最低1点并保留1点气血', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.setHp(101);
    const skill = AbilityFactory.create({
      slug: 'ratio-cost', name: '比例成本', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.08, minimum: 1, retain: 1 }],
      effects: [],
    });
    skill.setOwner(caster);
    const events: AbilityCostPaidEvent[] = [];
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => events.push(event));

    expect(skill.canTrigger({ caster, target })).toBe(true);
    skill.execute({ caster, target });
    expect(caster.getCurrentHp()).toBe(92);
    expect(events[0]).toMatchObject({ beforeHp: 101, afterHp: 92, hpPaid: 9 });

    caster.setHp(1);
    expect(skill.canTrigger({ caster, target })).toBe(false);
  });

  it('任意配置气血线直接读取成本事件前后比例', () => {
    const caster = unit('caster');
    const target = unit('target');
    const event = {
      type: 'AbilityCostPaidEvent', timestamp: Date.now(), caster,
      ability: AbilityFactory.create({
        slug: 'threshold-source', name: '阈值来源', type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      }),
      beforeHp: 650, afterHp: 620, beforeMp: 0, afterMp: 0,
      hpPaid: 30, mpPaid: 0, beforeHpRatio: 0.65, afterHpRatio: 0.62,
    } satisfies AbilityCostPaidEvent;

    expect(checkConditions({ caster, target, triggerEvent: event }, [{
      type: 'ability_cost_crossed', params: { value: 0.63 },
    }])).toBe(true);
    expect(checkConditions({ caster, target, triggerEvent: event }, [{
      type: 'ability_cost_crossed', params: { value: 0.7 },
    }])).toBe(false);
  });

  it('所有气血写入路径发布统一变化事件并保留原因', () => {
    const caster = unit('caster');
    const events: HpChangedEvent[] = [];
    EventBus.instance.subscribe<HpChangedEvent>('HpChangedEvent', (event) => events.push(event));

    caster.takeDamage(10);
    caster.heal(4);
    caster.setHp(caster.getCurrentHp() - 3, 'ability_cost');

    expect(events.map((event) => event.reason)).toEqual(['damage', 'heal', 'ability_cost']);
    expect(events.map((event) => event.delta)).toEqual([-10, 4, -3]);
  });

  it('气血成本是原子支付，不发布受击事件也不进入伤害管道', () => {
    const caster = unit('caster');
    const skill = AbilityFactory.create({
      slug: 'atomic-cost', name: '原子成本', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.1, retain: 1 }],
      effects: [],
    });
    skill.setOwner(caster);
    let damageEvents = 0;
    let costEvents = 0;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', () => { damageEvents += 1; });
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', () => { costEvents += 1; });

    skill.execute({ caster, target: caster });
    expect(costEvents).toBe(1);
    expect(damageEvents).toBe(0);
    expect(caster.isAlive()).toBe(true);
  });

  it('按首段效果前的目标已损气血线性追加系数', () => {
    const caster = unit('caster');
    const target = unit('target');
    target.setHp(Math.round(target.getMaxHp() * 0.5));
    const attack = caster.attributes.getValue(AttributeType.ATK);
    const skill = AbilityFactory.create({
      slug: 'missing-hp-snapshot', name: '摘心', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.PHYSICAL],
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.ATK, coefficient: 0.6 },
          damageType: DamageType.PHYSICAL,
          damageSource: DamageSource.DIRECT,
          dynamicScalars: [{
            source: 'target_missing_hp_ratio',
            attribute: AttributeType.ATK,
            coefficientCap: 0.4,
            timing: 'cast',
          }],
        },
      }],
    }) as ActiveSkill;
    skill.setOwner(caster);
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => requests.push(event));

    skill.prepareCast({ caster, target });
    skill.execute({ caster, target });

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBeCloseTo(Math.round(attack * 0.6) + attack * 0.2, 5);
    expect(requests[0].damageComponents).toContainEqual(expect.objectContaining({
      kind: `target_missing_hp:${AttributeType.ATK}`,
      segmentMultiplier: 0.2,
    }));
  });

  it('条件暴击读取支付后快照，不受前置治疗改变', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.setHp(Math.floor(caster.getMaxHp() * 0.38));
    const skill = AbilityFactory.create({
      slug: 'cast-critical-snapshot', name: '三叩', type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.FUNCTION.HEAL,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.1, retain: 1 }],
      effects: [
        { type: 'heal', params: { value: { targetMaxHpRatio: 0.1 }, recipient: 'caster' } },
        {
          type: 'damage',
          params: {
            value: { attribute: AttributeType.ATK, coefficient: 0.8 },
            damageType: DamageType.PHYSICAL,
            forceCriticalConditions: [{
              type: 'hp_below',
              params: { scope: 'caster', value: 0.35, timing: 'cast' },
            }],
          },
        },
      ],
    }) as ActiveSkill;
    skill.setOwner(caster);
    let request: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => { request = event; });
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', () => {
      caster.heal(Math.round(caster.getMaxHp() * 0.2));
    });

    skill.prepareCast({ caster, target });
    skill.execute({ caster, target });

    expect(caster.getHpPercent()).toBeGreaterThan(0.35);
    expect(request).toMatchObject({ forceCritical: true, isCritical: true });
  });

  it('记忆部分释放只使用实际消费量，并遵守释放上限', () => {
    const caster = unit('caster');
    const target = unit('target');
    const record = AbilityFactory.createEffect({
      type: 'damage_memory',
      params: { key: 'tide', mode: 'record', event: 'ability_cost_paid', target: 'caster' },
    })!;
    const release = AbilityFactory.createEffect({
      type: 'damage_memory',
      params: {
        key: 'tide', mode: 'release', ratio: 2, releaseAs: 'follow_up',
        target: 'caster', consume: true, consumeRatio: 0.5,
        maxReleaseValue: { base: 60 },
      },
    })!;
    record.execute({
      caster,
      target,
      triggerEvent: {
        type: 'AbilityCostPaidEvent', timestamp: Date.now(), caster,
        ability: AbilityFactory.create({
          slug: 'record-source', name: '记录', type: AbilityType.ACTIVE_SKILL,
          tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
        }),
        beforeHp: 200, afterHp: 100, beforeMp: 0, afterMp: 0,
        hpPaid: 100, mpPaid: 0, beforeHpRatio: 1, afterHpRatio: 0.5,
      },
    });
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => requests.push(event));

    release.execute({ caster, target });

    expect(requests[0].baseDamage).toBe(60);
    expect(readMemory(caster, 'tide').amount).toBe(50);
  });

  it('按消费层数只缩放数值强度，状态转移仍只执行一次并保留原来源', () => {
    const caster = unit('caster');
    const target = unit('target');
    const originalSource = unit('original-source');
    const marker = BuffFactory.create({
      id: 'two-layer-marker', name: '两层标记', type: BuffType.BUFF,
      duration: -1, stackRule: StackRule.STACK_LAYER, maxLayers: 2,
    });
    caster.buffs.addBuff(marker, caster);
    caster.buffs.addBuff(marker.clone(), caster);
    for (const id of ['negative-a', 'negative-b']) {
      caster.buffs.addBuff(BuffFactory.create({
        id, name: id, type: BuffType.DEBUFF, duration: 3,
        stackRule: StackRule.OVERRIDE,
      }), originalSource);
    }
    const consume = AbilityFactory.createEffect({
      type: 'consume_status_trigger',
      params: {
        match: { id: 'two-layer-marker' }, consume: 2, target: 'caster',
        scaleNumericEffectsByLayer: true,
        effects: [
          { type: 'damage', params: { value: { attribute: AttributeType.ATK, coefficient: 0.2 } } },
          { type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: 1 } },
        ],
      },
    })!;
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => requests.push(event));

    consume.execute({ caster, target });

    expect(requests).toHaveLength(1);
    expect(requests[0].damageComponents).toContainEqual(expect.objectContaining({ segmentMultiplier: 0.4 }));
    expect(caster.buffs.getAllBuffs().filter((buff) => buff.type === BuffType.DEBUFF)).toHaveLength(1);
    const moved = target.buffs.getAllBuffs().find((buff) => buff.type === BuffType.DEBUFF);
    expect(moved?.getSource()).toBe(originalSource);
    expect(moved?.getDuration()).toBe(3);
  });

  it('数值缩放递归进入嵌套消费效果，离散消费次数保持一次', () => {
    const caster = unit('caster');
    const target = unit('target');
    const addLayered = (unit: Unit, id: string, layers: number) => {
      const marker = BuffFactory.create({
        id, name: id, type: BuffType.BUFF, duration: -1,
        stackRule: StackRule.STACK_LAYER, maxLayers: layers,
      });
      for (let index = 0; index < layers; index += 1) unit.buffs.addBuff(marker.clone(), unit);
    };
    addLayered(caster, 'outer', 2);
    addLayered(target, 'inner', 3);
    const effect = AbilityFactory.createEffect({
      type: 'consume_status_trigger',
      params: {
        match: { id: 'outer' }, consume: 2, target: 'caster',
        scaleNumericEffectsByLayer: true,
        effects: [{
          type: 'consume_status_trigger',
          params: {
            match: { id: 'inner' }, consume: 'all', target: 'target',
            scaleEffectsByLayer: true,
            effects: [{ type: 'damage', params: { value: { attribute: AttributeType.ATK, coefficient: 0.2 } } }],
          },
        }],
      },
    })!;
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => requests.push(event));

    effect.execute({ caster, target });

    expect(requests).toHaveLength(3);
    expect(requests.every((event) =>
      event.damageComponents?.some((component) => component.segmentMultiplier === 0.4),
    )).toBe(true);
    expect(target.buffs.getAllBuffIds()).not.toContain('inner');
  });

  it('同一消费效果禁止同时重复次数与缩放数值', () => {
    expect(() => AbilityFactory.createEffect({
      type: 'consume_status_trigger',
      params: {
        match: { id: 'marker' }, consume: 'all', effects: [],
        scaleEffectsByLayer: true, scaleNumericEffectsByLayer: true,
      },
    })).toThrow('不能同时');
  });

  it('数值越低越强的伤害上限按反方向缩放', () => {
    const scaled = scaleEffectNumericStrength({
      type: 'damage_cap', params: { maxHpRatio: 0.3, deferOverflowTurns: 1 },
    }, 1.2);
    expect(scaled.type).toBe('damage_cap');
    if (scaled.type === 'damage_cap') expect(scaled.params.maxHpRatio).toBeCloseTo(0.25);
  });

  it('数值缩放强化吸血与共享上限，但不缩放冷却回合等离散语义', () => {
    const lifesteal = scaleEffectNumericStrength({
      type: 'lifesteal', params: { ratio: 0.25, maxHpRatioPerAction: 0.08 },
    }, 1.2);
    expect(lifesteal).toMatchObject({
      type: 'lifesteal', params: { ratio: 0.3, maxHpRatioPerAction: 0.096 },
    });

    const cooldown = scaleEffectNumericStrength({
      type: 'cooldown_modify', params: { cdModifyValue: -2 },
    }, 1.2);
    expect(cooldown).toEqual({ type: 'cooldown_modify', params: { cdModifyValue: -2 } });
  });

  it('protected状态拒绝普通驱散但仍可由机制主动清理', () => {
    const caster = unit('caster');
    const target = unit('target');
    target.buffs.addBuff(BuffFactory.create({
      id: 'normal', name: '普通', type: BuffType.BUFF, duration: 2,
      stackRule: StackRule.OVERRIDE,
    }), caster);
    target.buffs.addBuff(BuffFactory.create({
      id: 'protected', name: '保护', type: BuffType.BUFF, duration: -1,
      stackRule: StackRule.OVERRIDE, dispelPolicy: 'protected',
    }), caster);
    const dispel = AbilityFactory.createEffect({
      type: 'dispel', params: { maxCount: 2 },
    })!;

    dispel.execute({ caster, target });
    expect(target.buffs.getAllBuffIds()).toEqual(['protected']);
    expect(target.buffs.removeBuffDispel('protected')).toBe(false);
    target.buffs.removeBuff('protected');
    expect(target.buffs.getAllBuffIds()).toHaveLength(0);
  });

  it('正式执行前资源变化会取消原承诺并改用无标签徒手攻击', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create({
      slug: 'expensive-sect-technique', name: '宗门神通', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF, 'Ability.Sect.Test.Technique'],
      costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.5, retain: 1 }],
      cooldown: 3,
      effects: [],
    }) as ActiveSkill;
    skill.setOwner(caster);
    skill.setActive(true);
    const system = new ActionExecutionSystem();
    const casts: SkillCastEvent[] = [];
    const costs: AbilityCostPaidEvent[] = [];
    EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => casts.push(event));
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => costs.push(event));
    skill.prepareCast({ caster, target });
    caster.setHp(1);

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster, target,
      fallbackTarget: target, ability: skill, isInterrupted: false,
    });

    system.destroy();
    expect(casts[0].ability.id).toBe('basic_attack');
    expect(casts[0].ability.tags.hasTag('Ability.Sect.Test.Technique')).toBe(false);
    expect(costs).toHaveLength(1);
    expect(costs[0]).toMatchObject({ hpPaid: 0, mpPaid: 0 });
    expect(skill.currentCooldown).toBe(0);
    expect(caster.getCurrentHp()).toBe(1);
  });

  it('冻结施法承诺时的变体，结算完才恢复实时解析', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = new DynamicDataDrivenActiveSkill('dynamic-test', '佛相式', {
      cooldown: 0,
      targetPolicy: TargetPolicy.default(),
      variants: [
        {
          id: 'formless', name: '无相式', priority: 300,
          conditions: [{ type: 'ability_mode_is', params: { scope: 'caster', key: 'form', mode: 'formless' } }],
          costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.08, retain: 1 }],
          targetPolicy: { team: 'self', scope: 'single' },
          selectionProfile: { intents: ['defensive'] },
          effects: [],
        },
        {
          id: 'demon', name: '魔相式', priority: 200,
          conditions: [{ type: 'ability_mode_is', params: { scope: 'caster', key: 'form', mode: 'demon' } }],
          costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.05, retain: 1 }],
          targetPolicy: { team: 'enemy', scope: 'single' },
          selectionProfile: { intents: ['damage'] },
          effects: [],
        },
        { id: 'buddha', name: '佛相式', priority: 0, conditions: [], costs: [], effects: [] },
      ],
    });
    skill.setOwner(caster);
    setAbilityMode(caster, { key: 'form', mode: 'formless', phase: 1, remainingUses: 1, displayName: '无相待发' });
    skill.prepareCast({ caster, target });
    setAbilityMode(caster, { key: 'form', mode: 'demon', phase: 1, remainingUses: 2, displayName: '魔相' });

    expect(skill.name).toBe('无相式');
    expect(skill.runtimeVariantId).toBe('formless');
    expect(skill.targetPolicy.team).toBe('self');
    expect(skill.selectionProfile?.intents).toEqual(['defensive']);
    expect(skill.preparedTarget).toBe(target);
    skill.execute({ caster, target });
    expect(skill.name).toBe('魔相式');
    expect(skill.targetPolicy.team).toBe('enemy');
  });

  it('形态只在技能效果成功结算时推进，未命中不会消费次数', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create({
      slug: 'mode-success', name: '形态推进', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      effects: [{ type: 'ability_mode', params: { key: 'form', operation: 'advance' } }],
    });
    skill.setOwner(caster);
    setAbilityMode(caster, { key: 'form', mode: 'demon', phase: 1, remainingUses: 2, displayName: '魔相' });

    skill.execute({ caster, target, shouldApplyEffects: false });
    expect(readAbilityMode(caster, 'form')).toMatchObject({ phase: 1, remainingUses: 2 });
    skill.execute({ caster, target, shouldApplyEffects: true });
    expect(readAbilityMode(caster, 'form')).toMatchObject({ phase: 2, remainingUses: 1 });
  });

  it('魔相多段直接伤害共享自身行动吸血上限', () => {
    const caster = unit('caster');
    const target = unit('target');
    const maxHp = caster.getMaxHp();
    caster.takeDamage(Math.round(maxHp * 0.5));
    const before = caster.getCurrentHp();
    const lifesteal = AbilityFactory.createEffect({
      type: 'lifesteal',
      params: { ratio: 0.25, maxHpRatioPerAction: 0.08 },
    })!;
    beginRuntimeAction(caster);
    for (let index = 0; index < 3; index += 1) {
      lifesteal.execute({
        caster,
        target,
        triggerEvent: {
          type: 'DamageTakenEvent', timestamp: Date.now(), caster, target,
          damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
          damageTaken: Math.round(maxHp * 0.2), beforeHp: target.getCurrentHp(),
          remainHp: target.getCurrentHp(), isLethal: false,
        },
      });
    }
    expect(caster.getCurrentHp() - before).toBe(Math.round(maxHp * 0.08));
  });

  it('普通百分比减伤总和封顶70%', () => {
    const caster = unit('caster');
    const target = unit('target');
    const system = new DamageSystem();
    const before = target.getCurrentHp();
    EventBus.instance.publish({
      type: 'DamageRequestEvent', timestamp: Date.now(), target,
      damageSource: DamageSource.DIRECT, damageType: DamageType.TRUE,
      baseDamage: 1000, finalDamage: 1000, damageReductionPctBucket: 2,
    });
    const loss = before - target.getCurrentHp();
    system.destroy();
    expect(loss).toBeGreaterThanOrEqual(270);
    expect(loss).toBeLessThanOrEqual(330);
  });
});
