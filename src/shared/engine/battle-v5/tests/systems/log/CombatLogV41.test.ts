import { AbilityType, AttributeType, DamageSource, DamageType } from '../../../core/types';
import { EventBus } from '../../../core/EventBus';
import type {
  ActionStateEvent,
  BattleInitEvent,
  DamageTakenEvent,
  SkillCastEvent,
} from '../../../core/events';
import { AbilityFactory } from '../../../factories/AbilityFactory';
import { CombatLogSystem } from '../../../systems/log/CombatLogSystem';
import { LogPresenter } from '../../../systems/log/LogPresenter';
import { Unit } from '../../../units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function damageAbility(id: string, name: string) {
  return AbilityFactory.create({
    slug: id,
    name,
    type: AbilityType.ACTIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    effects: [{
      type: 'damage',
      params: { value: { attribute: AttributeType.ATK, coefficient: 1 } },
    }],
  });
}

describe('V4.1结构化战斗日志', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('保留多段、暴击、护盾、资源与行动状态并隐藏内部ID', () => {
    const actor = new Unit('actor', '甲', {});
    const target = new Unit('target', '乙', {});
    actor.combatResources.define({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      initial: 2,
      max: 6,
    });
    const ability = damageAbility('five-strikes', '流光五叠');
    const logs = new CombatLogSystem();
    logs.subscribe(EventBus.instance);

    EventBus.instance.publish<BattleInitEvent>({
      type: 'BattleInitEvent',
      timestamp: Date.now(),
      player: actor,
      opponent: target,
    });
    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: actor,
      target,
      ability,
    });
    const segments = [
      { damageTaken: 112, shieldAbsorbed: 0, isCritical: false },
      { damageTaken: 108, shieldAbsorbed: 12, isCritical: false },
      { damageTaken: 215, shieldAbsorbed: 0, isCritical: true },
      { damageTaken: 106, shieldAbsorbed: 0, isCritical: false },
      { damageTaken: 110, shieldAbsorbed: 0, isCritical: false },
    ];
    for (const [index, segment] of segments.entries()) {
      EventBus.instance.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        timestamp: Date.now(),
        caster: actor,
        target,
        ability,
        damageSource: DamageSource.DIRECT,
        damageType: DamageType.PHYSICAL,
        damageTaken: segment.damageTaken,
        beforeHp: 1_000 - index * 100,
        remainHp: 1_000 - index * 100 - segment.damageTaken,
        shieldAbsorbed: segment.shieldAbsorbed,
        remainShield: 0,
        isLethal: false,
        isCritical: segment.isCritical,
      });
    }
    actor.combatResources.modify('sect.lingxiao.sword-momentum', 2, {
      caster: actor,
      ability,
    });
    EventBus.instance.publish<ActionStateEvent>({
      type: 'ActionStateEvent',
      timestamp: Date.now(),
      unit: actor,
      stateType: 'rest',
      phase: 'entered',
      name: '调息',
      remainingActions: 1,
      sourceAbility: { id: ability.id, name: ability.name },
    });

    const output = logs.getPlayerLogs();
    const text = output.join('\n');
    expect(output).toContain('「甲」以2点剑势进入战斗');
    expect(text).toContain('「甲」施放《流光五叠》，对「乙」连续命中5段：');
    expect(text).toContain('112、108（护盾吸收12）、215（暴击）、106、110，合计651点气血伤害，护盾共吸收12点');
    expect(text).toContain('获得2点剑势（4/6）');
    expect(text).toContain('进入「调息」，下一次行动跳过');
    expect(text).not.toMatch(/sect\.|Status\.|Ability\./);

    const actionSpan = logs.getSpans().find((span) => span.type === 'action');
    expect(actionSpan?.entries.filter((entry) => entry.type === 'damage')).toHaveLength(5);
    expect(actionSpan?.entries.filter((entry) => entry.type === 'resource_change')).toHaveLength(1);
    expect(actionSpan?.entries.filter((entry) => entry.type === 'mechanic')).toHaveLength(0);
    expect(actionSpan && logs.getSpans().length > 0).toBeTruthy();
    const presenter = new LogPresenter();
    const presented = presenter.presentSpan(actionSpan!);
    expect(presented.flatMap((line) => line.parts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'ability', text: '《流光五叠》' }),
        expect.objectContaining({ kind: 'resource', text: '剑势' }),
        expect.objectContaining({ kind: 'critical', text: '暴击' }),
        expect.objectContaining({ kind: 'status', text: '「调息」' }),
      ]),
    );
    expect(presenter.formatSpan(actionSpan!)).toEqual(
      presented.map((line) => line.parts.map((part) => part.text).join('')),
    );
    logs.destroy();
  });

  it('反击使用真实来源角色和神通名称', () => {
    const attacker = new Unit('attacker', '甲', {});
    const defender = new Unit('defender', '乙', {});
    const attack = damageAbility('attack', '问锋');
    const counter = damageAbility('counter', '回澜');
    const logs = new CombatLogSystem();
    logs.subscribe(EventBus.instance);
    EventBus.instance.publish<BattleInitEvent>({
      type: 'BattleInitEvent',
      timestamp: Date.now(),
      player: attacker,
      opponent: defender,
    });
    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: attack,
    });
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: defender,
      target: attacker,
      ability: counter,
      damageSource: DamageSource.COUNTER,
      damageType: DamageType.PHYSICAL,
      damageTaken: 180,
      beforeHp: 1_000,
      remainHp: 820,
      isLethal: false,
    });

    expect(logs.getPlayerLogs().join('\n')).toContain(
      '「乙」触发「回澜」反击，对「甲」造成180点伤害',
    );
    logs.destroy();
  });
});
