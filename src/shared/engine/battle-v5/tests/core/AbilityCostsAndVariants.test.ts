import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DynamicDataDrivenActiveSkill } from '../../abilities/DynamicDataDrivenActiveSkill';
import { TargetPolicy } from '../../abilities/TargetPolicy';
import { EventBus } from '../../core/EventBus';
import type { AbilityCostPaidEvent, DamageTakenEvent } from '../../core/events';
import { beginRuntimeAction, readAbilityMode, setAbilityMode } from '../../core/runtimeState';
import { AbilityType, AttributeType, DamageSource, DamageType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
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
          costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.08, retain: 1 }], effects: [],
        },
        {
          id: 'demon', name: '魔相式', priority: 200,
          conditions: [{ type: 'ability_mode_is', params: { scope: 'caster', key: 'form', mode: 'demon' } }],
          costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.05, retain: 1 }], effects: [],
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
    skill.execute({ caster, target });
    expect(skill.name).toBe('魔相式');
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
      type: 'DamageRequestEvent', timestamp: Date.now(), caster, target,
      damageSource: DamageSource.DIRECT, damageType: DamageType.TRUE,
      baseDamage: 1000, finalDamage: 1000, damageReductionPctBucket: 2,
    });
    const loss = before - target.getCurrentHp();
    system.destroy();
    expect(loss).toBeGreaterThanOrEqual(270);
    expect(loss).toBeLessThanOrEqual(330);
  });
});
