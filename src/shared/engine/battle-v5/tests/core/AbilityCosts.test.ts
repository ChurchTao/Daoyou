import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActiveSkill } from '../../abilities/ActiveSkill';
import { EventBus } from '../../core/EventBus';
import type { AbilityCostPaidEvent, DamageRequestEvent, DamageTakenEvent } from '../../core/events';
import { AbilityType, AttributeType, DamageSource, DamageType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { GameplayTags } from '../../../shared/tag-domain';
import { Unit } from '../../units/Unit';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.WISDOM]: 10,
    [AttributeType.SPEED]: 10,
    [AttributeType.WILLPOWER]: 10,
  });
}

describe('主动技能气血成本', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('按施法前当前气血向上取整并至少保留1点', () => {
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

    skill.execute({ caster, target });
    expect(caster.getCurrentHp()).toBe(92);
    expect(events[0]).toMatchObject({ beforeHp: 101, afterHp: 92, hpPaid: 9 });
    caster.setHp(1);
    expect(skill.canTrigger({ caster, target })).toBe(false);
  });

  it('条件成本在施法准备时按战斗资源选择并冻结', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.combatResources.define({ id: 'intent', name: '战意', initial: 6, max: 6 });
    const skill = AbilityFactory.create({
      slug: 'conditional-cost', name: '转相', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      costs: [
        {
          resource: 'hp', mode: 'current_hp_ratio', ratio: 0.04,
          conditions: [{ type: 'combat_resource_below', params: { scope: 'caster', resourceId: 'intent', value: 6 } }],
        },
        {
          resource: 'hp', mode: 'current_hp_ratio', ratio: 0.08,
          conditions: [{ type: 'combat_resource_at_least', params: { scope: 'caster', resourceId: 'intent', value: 6 } }],
        },
      ],
      effects: [],
    }) as ActiveSkill;
    skill.setOwner(caster);
    const before = caster.getCurrentHp();
    skill.prepareCast({ caster, target });
    caster.combatResources.modify('intent', -6);
    skill.execute({ caster, target });
    expect(before - caster.getCurrentHp()).toBe(Math.ceil(before * 0.08));
  });

  it('气血成本原子支付，不发布受击事件', () => {
    const caster = unit('caster');
    const skill = AbilityFactory.create({
      slug: 'atomic-cost', name: '原子成本', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.1, retain: 1 }],
      effects: [],
    });
    skill.setOwner(caster);
    let damageEvents = 0;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', () => { damageEvents += 1; });
    skill.execute({ caster, target: caster });
    expect(damageEvents).toBe(0);
    expect(caster.isAlive()).toBe(true);
  });

  it('伤害动态标量读取施法开始时目标已损气血', () => {
    const caster = unit('caster');
    const target = unit('target');
    target.setHp(Math.round(target.getMaxHp() * 0.5));
    const attack = caster.attributes.getValue(AttributeType.ATK);
    const skill = AbilityFactory.create({
      slug: 'missing-hp-snapshot', name: '摘心', type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.ATK, coefficient: 0.6 },
          damageType: DamageType.PHYSICAL,
          damageSource: DamageSource.DIRECT,
          dynamicScalars: [{
            source: 'target_missing_hp_ratio', attribute: AttributeType.ATK,
            coefficientCap: 0.4, timing: 'cast',
          }],
        },
      }],
    }) as ActiveSkill;
    skill.setOwner(caster);
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => requests.push(event));

    skill.prepareCast({ caster, target });
    target.heal(target.getMaxHp());
    skill.execute({ caster, target });
    expect(requests[0].baseDamage).toBeCloseTo(Math.round(attack * 0.6) + attack * 0.2, 5);
  });
});
