import { Ability } from '../../abilities/Ability';
import { StackRule } from '../../buffs/Buff';
import { checkConditions } from '../../core/conditionEvaluator';
import { EventBus } from '../../core/EventBus';
import type { DamageTakenEvent, HealEvent } from '../../core/events';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { BuffFactory } from '../../factories/BuffFactory';
import { EffectRegistry } from '../../factories/EffectRegistry';
import { BuffCopyEffect } from '../../effects/BuffCopyEffect';
import { DamageSystem } from '../../systems/DamageSystem';
import { calculateSpiritualRootDamageMultiplier } from '../../systems/spiritualRootResonance';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function unit(id: string): Unit {
  return new Unit(id, id, {});
}

describe('天衍所需通用 battle-v5 扩展', () => {
  beforeEach(() => {
    EventBus.instance.reset();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it('灵根匹配优先于异灵根失配豁免', () => {
    const caster = unit('caster');
    caster.setSpiritualRoots([{ element: '火', strength: 80 }]);
    const ability = new Ability('fire', '火法', AbilityType.ACTIVE_SKILL);
    ability.tags.addTags([
      GameplayTags.ABILITY.ELEMENT.FIRE,
      GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
    ]);

    expect(calculateSpiritualRootDamageMultiplier({ caster, ability })).toBe(1.16);
  });

  it('异灵根元素带通用标签时按1.0结算且不向普通技能泄漏', () => {
    const caster = unit('caster');
    caster.setSpiritualRoots([{ element: '水', strength: 80 }]);
    const exempt = new Ability('fire-exempt', '火法', AbilityType.ACTIVE_SKILL);
    exempt.tags.addTags([
      GameplayTags.ABILITY.ELEMENT.FIRE,
      GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
    ]);
    const ordinary = new Ability('fire-normal', '寻常火法', AbilityType.ACTIVE_SKILL);
    ordinary.tags.addTags([GameplayTags.ABILITY.ELEMENT.FIRE]);

    expect(calculateSpiritualRootDamageMultiplier({ caster, ability: exempt })).toBe(1);
    expect(calculateSpiritualRootDamageMultiplier({ caster, ability: ordinary })).toBe(0.85);
  });

  it('countsAsStatus=false 的机制状态不进入普通状态计数但仍可显式查找', () => {
    const caster = unit('caster');
    const seal = BuffFactory.create({
      id: 'test.seal',
      name: '法印',
      type: BuffType.BUFF,
      duration: 2,
      stackRule: StackRule.OVERRIDE,
      dispelPolicy: 'protected',
      countsAsStatus: false,
      tags: [GameplayTags.BUFF.TYPE.BUFF],
    });
    caster.buffs.addBuff(seal, caster);

    expect(checkConditions(
      { caster, target: caster },
      [{ type: 'buff_count_at_least', params: { scope: 'caster', value: 1 } }],
    )).toBe(false);
    expect(checkConditions(
      { caster, target: caster },
      [{ type: 'buff_layer_at_least', params: { scope: 'caster', id: 'test.seal', value: 1 } }],
    )).toBe(true);
  });

  it('source_has_tag 可统一匹配能力来源或Buff来源标签', () => {
    const caster = unit('caster');
    const target = unit('target');
    const tag = GameplayTags.ABILITY.ELEMENT.WOOD;
    const ability = new Ability('wood-heal', '木行治疗', AbilityType.ACTIVE_SKILL);
    ability.tags.addTags([tag]);
    const sourceBuff = BuffFactory.create({
      id: 'wood-hot',
      name: '木行持续治疗',
      type: BuffType.BUFF,
      duration: 2,
      tags: [tag],
    });
    const conditions = [{
      type: 'source_has_tag' as const,
      params: { tag },
    }];

    expect(checkConditions({ caster, target, ability }, conditions)).toBe(true);
    expect(checkConditions({
      caster,
      target,
      triggerEvent: { buff: sourceBuff },
    }, conditions)).toBe(true);
  });

  it('protected 机制状态不会被通用Buff复制效果复制', () => {
    const caster = unit('caster');
    const target = unit('target');
    target.buffs.addBuff(BuffFactory.create({
      id: 'test.protected-seal',
      name: '受保护法印',
      type: BuffType.BUFF,
      duration: 2,
      dispelPolicy: 'protected',
    }), target);

    new BuffCopyEffect({
      match: { id: 'test.protected-seal' },
      target: 'caster',
    }).execute({ caster, target });

    expect(caster.buffs.getAllBuffIds()).not.toContain('test.protected-seal');
  });

  it('单次控制效果可追加控制命中且不修改施法者全局属性', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const caster = unit('caster');
    const target = unit('target');
    target.attributes.addModifier({
      id: 'control-resistance',
      attrType: AttributeType.CONTROL_RESISTANCE,
      type: ModifierType.OVERRIDE,
      value: 0.5,
      source: 'test',
    });
    target.updateDerivedStats();
    const before = caster.attributes.getValue(AttributeType.CONTROL_HIT);

    EffectRegistry.getInstance().create({
      type: 'apply_buff',
      params: {
        controlHitBonus: 0.5,
        target: 'target',
        buffConfig: {
          id: 'test.scoped-control',
          name: '定身',
          type: BuffType.CONTROL,
          duration: 1,
          stackRule: StackRule.REFRESH_DURATION,
        },
      },
    })?.execute({ caster, target });

    expect(target.buffs.getAllBuffIds()).toContain('test.scoped-control');
    expect(caster.attributes.getValue(AttributeType.CONTROL_HIT)).toBe(before);
  });

  it('按施法快照返还实际支付法力', () => {
    const caster = unit('caster');
    const target = unit('target');
    const before = caster.getCurrentMp();
    caster.consumeMp(50);
    const events: HealEvent[] = [];
    EventBus.instance.subscribe<HealEvent>('HealEvent', (event) => events.push(event));

    EffectRegistry.getInstance().create({
      type: 'refund_paid_cost',
      params: { ratio: 0.2 },
    })?.execute({
      caster,
      target,
      castSnapshot: {
        target,
        targetId: target.id,
        costs: [],
        casterHpBeforeCost: caster.getCurrentHp(),
        casterHpAfterCost: caster.getCurrentHp(),
        casterHpRatioAfterCost: 1,
        casterMpBeforeCost: before,
        casterMpAfterCost: before - 50,
        targetHpBeforeEffects: target.getCurrentHp(),
        targetHpRatioBeforeEffects: 1,
      },
    });

    expect(caster.getCurrentMp()).toBe(before - 40);
    expect(events.at(-1)).toMatchObject({ healAmount: 10, healType: 'mp' });
  });

  it('手动结算按原Buff和原施术者执行，remaining_remove 结算剩余次数后移除', () => {
    const system = new DamageSystem();
    const caster = unit('caster');
    const target = unit('target');
    caster.attributes.addModifier({
      id: 'magic-atk',
      attrType: AttributeType.MAGIC_ATK,
      type: ModifierType.OVERRIDE,
      value: 100,
      source: 'test',
    });
    caster.updateDerivedStats();
    const burn = BuffFactory.create({
      id: 'test.burn',
      name: '灼烧',
      type: BuffType.DEBUFF,
      duration: 2,
      stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.BURN],
      manualSettlementEffects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.MAGIC_ATK, coefficient: 0.1 },
          damageType: DamageType.DOT,
          damageSource: DamageSource.DELAYED,
        },
      }],
    });
    target.buffs.addBuff(burn, caster);
    const taken: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => taken.push(event),
      -1_000,
    );

    EffectRegistry.getInstance().create({
      type: 'buff_periodic_settlement',
      params: {
        match: { id: 'test.burn' },
        mode: 'remaining_remove',
        source: 'caster',
        cause: { kind: 'mechanic', id: 'vaporize', displayName: '蒸发' },
      },
    })?.execute({ caster, target });

    expect(taken).toHaveLength(2);
    expect(taken.every((event) => event.buff?.name === '灼烧')).toBe(true);
    expect(taken.every((event) => event.caster === caster)).toBe(true);
    expect(taken.every((event) => event.cause?.displayName === '蒸发')).toBe(true);
    expect(target.buffs.getAllBuffIds()).not.toContain('test.burn');
    system.destroy();
  });
});
