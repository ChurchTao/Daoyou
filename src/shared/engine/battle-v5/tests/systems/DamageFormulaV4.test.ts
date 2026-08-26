import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { ValueCalculator } from '../../core/ValueCalculator';
import type { DamageSegmentRequestedEvent, DamageSegmentAppliedEvent } from '../../core/events';
import { rememberAmount } from '../../core/runtimeState';
import {
  AbilityType,
  AttributeType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { ReflectEffect } from '../../effects/ReflectEffect';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { publishTestDamageRequest } from '../setup/combatV3TestHarness';
import { executeTestEffect } from '../setup/executeTestEffect';
import { createHitResolution } from '../../core/resolution';

function unit(id: string): Unit {
  return new Unit(id, id, {});
}

function fixed(unit: Unit, attrType: AttributeType, value: number): void {
  unit.attributes.addModifier({
    id: `${unit.id}.${attrType}`,
    attrType,
    type: ModifierType.OVERRIDE,
    value,
    source: 'test',
  });
  unit.updateDerivedStats();
}

function request(args: {
  caster: Unit;
  target: Unit;
  amount: number;
  defenseScale: number;
  damageType?: DamageType;
  damageSource?: DamageSource;
  bypass?: number;
  forceCritical?: boolean;
}): DamageSegmentRequestedEvent {
  const bypass = args.bypass ?? 0;
  return {
    type: 'DamageSegmentRequestedEvent',
    timestamp: Date.now(),
    caster: args.caster,
    target: args.target,
    damageSource: args.damageSource ?? DamageSource.DIRECT,
    damageType: args.damageType ?? DamageType.PHYSICAL,
    baseDamage: args.amount,
    finalDamage: args.amount,
    forceCritical: args.forceCritical,
    damageComponents: [
      {
        kind: 'normal',
        amount: args.amount * (1 - bypass),
        mitigation: 'normal',
        attackBase: args.amount / args.defenseScale,
        segmentMultiplier: args.defenseScale * (1 - bypass),
      },
      ...(bypass > 0
        ? [
            {
              kind: 'bypass',
              amount: args.amount * bypass,
              mitigation: 'bypass_defense' as const,
            },
          ]
        : []),
    ],
  };
}

describe('V5平滑防御公式', () => {
  let system: DamageSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    system = new DamageSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    system.destroy();
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it.each([
    [DamageType.PHYSICAL, AttributeType.DEF],
    [DamageType.MAGICAL, AttributeType.MAGIC_DEF],
  ] as const)(
    '按攻击基数平滑结算%s防御后乘段倍率',
    (damageType, defenseAttr) => {
      const caster = unit('caster');
      const target = unit('target');
      fixed(target, defenseAttr, 100);
      const event = request({
        caster,
        target,
        amount: 100,
        defenseScale: 0.5,
        damageType,
      });
      publishTestDamageRequest(event);
      expect(event.finalDamage).toBe(67);
    },
  );

  it('相同总倍率的单段与多段不会因重复扣除整段防御而失真', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 100);
    const single = request({ caster, target, amount: 200, defenseScale: 1 });
    publishTestDamageRequest(single);
    const first = request({ caster, target, amount: 100, defenseScale: 0.5 });
    const second = request({ caster, target, amount: 100, defenseScale: 0.5 });
    publishTestDamageRequest(first);
    publishTestDamageRequest(second);
    expect(
      Math.abs(first.finalDamage + second.finalDamage - single.finalDamage),
    ).toBeLessThanOrEqual(1);
  });

  it('穿透限制后的有效防御按段倍率结算', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(caster, AttributeType.ARMOR_PENETRATION, 0.5);
    fixed(target, AttributeType.DEF, 100);
    const event = request({ caster, target, amount: 100, defenseScale: 0.5 });
    publishTestDamageRequest(event);
    expect(event.finalDamage).toBe(80);
  });

  it('混合穿防只对普通分量扣防', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 100);
    const event = request({
      caster,
      target,
      amount: 200,
      defenseScale: 1,
      bypass: 0.2,
    });
    publishTestDamageRequest(event);
    expect(event.finalDamage).toBe(147);
  });

  it('resolved_final 固定终值跳过防御、增减伤、暴击与随机浮动', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.MAGIC_DEF, 9999);
    fixed(caster, AttributeType.CRIT_RATE, 1);
    const event = request({
      caster,
      target,
      amount: 200,
      defenseScale: 1,
      damageType: DamageType.MAGICAL,
      damageSource: DamageSource.FOLLOW_UP,
      forceCritical: true,
    });
    event.calculationMode = 'resolved_final';
    event.damageIncreasePctBucket = 10;

    publishTestDamageRequest(event);

    expect(event.finalDamage).toBe(200);
    expect(event.isCritical).toBeUndefined();
  });

  it('固定值与属性合并为明确攻击基数和段倍率', () => {
    const caster = unit('caster');
    fixed(caster, AttributeType.ATK, 100);
    const result = ValueCalculator.calculateDetailed(
      { base: 20, attribute: AttributeType.ATK, coefficient: 0.5 },
      caster,
    );
    expect(result.total).toBe(70);
    expect(result.components).toEqual([
      {
        kind: `attribute:${AttributeType.ATK}`,
        amount: 70,
        mitigation: 'normal',
        attackBase: 140,
        segmentMultiplier: 0.5,
      },
    ]);
  });

  it('零属性倍率的固定值按纯固定伤害段处理', () => {
    const caster = unit('caster');
    const result = ValueCalculator.calculateDetailed(
      { base: 80, attribute: AttributeType.ATK, coefficient: 0 },
      caster,
    );
    expect(result.components).toEqual([
      {
        kind: 'base',
        amount: 80,
        mitigation: 'normal',
        attackBase: 80,
        segmentMultiplier: 1,
      },
    ]);
  });

  it('记忆追加伤害并入所属伤害段攻击基数而非隐性免防', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(caster, AttributeType.ATK, 100);
    fixed(target, AttributeType.DEF, 50);
    rememberAmount(caster, 'test.memory', 100);
    const ability = AbilityFactory.create({
      slug: 'test.memory-strike',
      name: '记忆一击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { attribute: AttributeType.ATK, coefficient: 0.5 },
          },
        },
      ],
    });
    executeTestEffect(
      AbilityFactory.createEffect({
        type: 'ability_transform',
        params: {
          id: 'test.memory-transform',
          bonusDamageMemory: { key: 'test.memory', ratio: 1 },
        },
      }),
      { caster, target: caster },
    );
    let requestEvent: DamageSegmentRequestedEvent | undefined;
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        if (event.ability?.id === ability.id) requestEvent = event;
      },
      -1_000,
    );

    ability.execute({ caster, target, resolution: createHitResolution({ actionId: 'formula:1', castId: 'formula:1', caster, target }) });

    expect(requestEvent?.damageComponents).toEqual([
      expect.objectContaining({
        attackBase: 300,
        segmentMultiplier: 0.5,
      }),
    ]);
    expect(requestEvent?.finalDamage).toBe(129);
  });

  it('反击正常扣防且强制暴击应用施法者暴击倍率', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 50);
    fixed(caster, AttributeType.CRIT_DAMAGE_MULT, 2);
    const expectedMultiplier = caster.attributes.getValue(
      AttributeType.CRIT_DAMAGE_MULT,
    );
    const event = request({
      caster,
      target,
      amount: 100,
      defenseScale: 1,
      damageSource: DamageSource.COUNTER,
      forceCritical: true,
    });
    publishTestDamageRequest(event);
    expect(event.isCritical).toBe(true);
    expect(event.critMultiplier).toBe(expectedMultiplier);
    expect(event.finalDamage).toBe(133);
  });

  it('直接伤害全部被护盾吸收时仍计为本行动已造成直接伤害', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.combatResources.define({
      id: 'test.momentum',
      name: '剑势',
      initial: 3,
      max: 6,
      decayOnNoDirectDamage: 1,
    });
    target.setShield(10_000);
    const hpBefore = target.getCurrentHp();
    caster.combatResources.beginAction();
    publishTestDamageRequest(
      request({ caster, target, amount: 100, defenseScale: 1 }),
    );
    caster.combatResources.finishAction(false, false);

    expect(target.getCurrentHp()).toBe(hpBefore);
    expect(target.getCurrentShield()).toBeLessThan(10_000);
    expect(caster.combatResources.getCurrent('test.momentum')).toBe(3);
  });

  it.each([DamageSource.REFLECT, DamageSource.COUNTER, DamageSource.FOLLOW_UP])(
    '二次伤害来源%s不会递归触发反伤',
    (damageSource) => {
      const caster = unit('caster');
      const target = unit('target');
      let reflected = 0;
      EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
        'DamageSegmentRequestedEvent',
        (event) => {
          if (event.damageSource === DamageSource.REFLECT) reflected += 1;
        },
      );
      const triggerEvent: DamageSegmentAppliedEvent = {
        type: 'DamageSegmentAppliedEvent',
        timestamp: Date.now(),
        caster,
        target,
        damageSource,
        damageTaken: 100,
        beforeHp: 200,
        remainHp: 100,
        hpReachedZeroBeforeReactions: false,
      };
      executeTestEffect(new ReflectEffect({ ratio: 0.5 }), {
        caster: target,
        target,
        triggerEvent,
      });
      expect(reflected).toBe(0);
    },
  );
});
