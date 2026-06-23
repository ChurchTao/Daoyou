import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { Buff, StackRule } from '../../buffs/Buff';
import { AbilityType, AttributeType, BuffType, DamageType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import {
  ActionPostEvent,
  BuffAddEvent,
  BuffAppliedEvent,
  CooldownModifyEvent,
  DamageEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  MechanicLogEvent,
  RoundPreEvent,
} from '../../core/events';
import {
  AbilityLockEffect,
  AbilityTransformEffect,
  BuffCopyEffect,
  BuffLayerModifyEffect,
  ConsumeStatusTriggerEffect,
  DamageMemoryEffect,
  DelayedEffect,
  DamageDeferEffect,
  ElementHistoryEffect,
  HpSacrificeDamageEffect,
  NextHitRuleEffect,
  TurnStateCounterEffect,
} from '../../effects/AdvancedEffects';
import { DamageEffect } from '../../effects/DamageEffect';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { markDamageDealt, readMemory } from '../../core/runtimeState';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';

function createUnit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.SPIRIT]: 100,
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
    [AttributeType.WISDOM]: 100,
  });
}

describe('Advanced battle effects', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('consumes matching status layers and executes child effects', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    poison.setLayer(3);
    target.buffs.addBuff(poison, caster);

    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new ConsumeStatusTriggerEffect({
      match: { tags: [GameplayTags.BUFF.DOT.POISON] },
      consume: 'all',
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 20, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    }).execute({ caster, target });

    expect(target.buffs.getAllBuffs()).toHaveLength(0);
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(20);
  });

  it('consume status trigger logs consumed layer count before removal', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison_log',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    poison.setLayer(3);
    target.buffs.addBuff(poison, caster);
    const mechanics: MechanicLogEvent[] = [];
    EventBus.instance.subscribe<MechanicLogEvent>('MechanicLogEvent', (event) => {
      mechanics.push(event);
    });

    new ConsumeStatusTriggerEffect({
      match: { tags: [GameplayTags.BUFF.DOT.POISON] },
      consume: 'all',
      effects: [],
    }).execute({ caster, target });

    expect(mechanics).toHaveLength(1);
    expect(mechanics[0]).toMatchObject({
      mechanic: 'buff_layer',
      value: 3,
      detail: 'consumed',
    });
  });

  it('delayed effect triggers on owner action post', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new DelayedEffect({
      id: 'delay_test',
      name: '延迟测试',
      delayTurns: 2,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 30, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    }).execute({ caster, target });

    const post = (): void =>
      EventBus.instance.publish<ActionPostEvent>({
        type: 'ActionPostEvent',
        timestamp: Date.now(),
        caster: target,
      });

    post();
    expect(requests).toHaveLength(0);
    post();
    expect(requests).toHaveLength(1);
    expect(target.buffs.getAllBuffs()).toHaveLength(0);
  });

  it('delayed effect cancels on dispel unless triggerOnDispel is enabled', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new DelayedEffect({
      id: 'delay_cancel_test',
      name: '延迟取消测试',
      delayTurns: 2,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 30, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    }).execute({ caster, target });

    target.buffs.removeBuffDispel('delay_cancel_test');
    expect(requests).toHaveLength(0);

    new DelayedEffect({
      id: 'delay_detonate_test',
      name: '延迟驱散触发测试',
      delayTurns: 2,
      triggerOnDispel: true,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 40, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    }).execute({ caster, target });

    target.buffs.removeBuffDispel('delay_detonate_test');
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(40);
  });

  it('delayed effect can record damage taken during the delay window', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new DelayedEffect({
      id: 'delay_memory_test',
      name: '延迟记忆测试',
      delayTurns: 1,
      record: { key: 'delay_damage', event: 'damage_taken' },
      effects: [
        {
          type: 'damage_memory',
          params: {
            key: 'delay_damage',
            mode: 'release',
            ratio: 0.5,
            releaseAs: 'damage',
            target: 'target',
          },
        },
      ],
    }).execute({ caster, target });

    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 80,
      beforeHp: target.getCurrentHp(),
      remainHp: target.getCurrentHp() - 80,
      isLethal: false,
    });
    EventBus.instance.publish<ActionPostEvent>({
      type: 'ActionPostEvent',
      timestamp: Date.now(),
      caster: target,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(40);
  });

  it('damage memory ignores same-id units from another runtime instance', () => {
    const owner = createUnit('same-id');
    const otherRuntimeOwner = createUnit('same-id');
    const attacker = createUnit('attacker');

    new DamageMemoryEffect({
      key: 'isolated_damage',
      mode: 'record',
      event: 'damage_taken',
      target: 'target',
    }).execute({
      caster: attacker,
      target: owner,
      triggerEvent: {
        type: 'DamageTakenEvent',
        timestamp: Date.now(),
        caster: attacker,
        target: otherRuntimeOwner,
        damageTaken: 100,
        beforeHp: 1000,
        remainHp: 900,
        isLethal: false,
      } satisfies DamageTakenEvent,
    });

    expect(readMemory(owner, 'isolated_damage').amount).toBe(0);
  });

  it('damage memory records and releases as shield without leaking through Unit fields', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const damageEvent: DamageTakenEvent = {
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 80,
      beforeHp: target.getCurrentHp(),
      remainHp: target.getCurrentHp() - 80,
      isLethal: false,
    };

    new DamageMemoryEffect({
      key: 'stored',
      mode: 'record',
      event: 'damage_taken',
      target: 'target',
    }).execute({ caster, target, triggerEvent: damageEvent });

    new DamageMemoryEffect({
      key: 'stored',
      mode: 'release',
      ratio: 0.5,
      releaseAs: 'shield',
      target: 'target',
    }).execute({ caster, target });

    expect(target.getCurrentShield()).toBe(40);
  });

  it('buff layer modify removes a buff at zero layers and scales child effects by previous layers', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mark = new Buff('mark', '印记', BuffType.DEBUFF, 3, StackRule.STACK_LAYER);
    mark.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);
    mark.setLayer(2);
    target.buffs.addBuff(mark, caster);

    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new BuffLayerModifyEffect({
      match: { id: 'mark' },
      operation: 'clear',
      scaleEffectsByLayer: true,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    }).execute({ caster, target });

    expect(target.buffs.getAllBuffs()).toHaveLength(0);
    expect(requests).toHaveLength(2);
  });

  it('stacking an existing buff emits applied event with updated layers for logs', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const applied: BuffAppliedEvent[] = [];
    EventBus.instance.subscribe<BuffAppliedEvent>('BuffAppliedEvent', (event) => {
      applied.push(event);
    });

    const first = new Buff('thunder_mark_log', '雷印', BuffType.DEBUFF, 3, StackRule.STACK_LAYER);
    first.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);
    const second = new Buff('thunder_mark_log', '雷印', BuffType.DEBUFF, 3, StackRule.STACK_LAYER);
    second.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);

    target.buffs.addBuff(first, caster);
    target.buffs.addBuff(second, caster);

    expect(applied).toHaveLength(2);
    expect(applied[1].buff.getLayer()).toBe(2);
  });

  it('ability transform affects the next matching damage once', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'transform_target',
      name: '变形目标',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new AbilityTransformEffect({
      id: 'next_true_crit',
      triggers: 1,
      trueDamage: true,
      forceCritical: true,
    }).execute({ caster, target: caster });

    new DamageEffect({
      value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
    }).execute({ caster, target, ability: skill });
    new DamageEffect({
      value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
    }).execute({ caster, target, ability: skill });

    expect(requests[0].damageType).toBe(DamageType.TRUE);
    expect(requests[0].isCritical).toBe(true);
    expect(requests[1].damageType).toBe(DamageType.MAGICAL);
    expect(requests[1].isCritical).toBeUndefined();
  });

  it('ability transform is consumed at skill level and applies across all damage effects once', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const debuffA = new Buff('debuff_a', '甲咒', BuffType.DEBUFF, 2, StackRule.OVERRIDE);
    const debuffB = new Buff('debuff_b', '乙咒', BuffType.DEBUFF, 2, StackRule.OVERRIDE);
    debuffA.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    debuffB.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(debuffA, caster);
    target.buffs.addBuff(debuffB, caster);

    const skill = AbilityFactory.create({
      slug: 'multi_hit_transform',
      name: '多段变形',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
        {
          type: 'damage',
          params: {
            value: { base: 12, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new AbilityTransformEffect({
      id: 'skill_level_transform',
      triggers: 1,
      trueDamage: true,
      addDispel: { targetTag: GameplayTags.BUFF.TYPE.DEBUFF, maxCount: 1 },
    }).execute({ caster, target: caster });

    skill.execute({ caster, target });
    skill.execute({ caster, target });

    expect(requests.slice(0, 2).map((event) => event.damageType)).toEqual([
      DamageType.TRUE,
      DamageType.TRUE,
    ]);
    expect(requests[2].damageType).toBe(DamageType.MAGICAL);
    expect(requests[3].damageType).toBe(DamageType.MAGICAL);
    expect(target.buffs.getAllBuffs()).toHaveLength(1);
  });

  it('apply_buff can explicitly apply a buff to the caster from an enemy-targeted effect', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'self_buff_from_attack',
      name: '攻中自益',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.BUFF],
      effects: [
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: 'self_haste',
              name: '自疾',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [GameplayTags.BUFF.TYPE.BUFF],
            },
          },
        },
      ],
    });

    skill.execute({ caster, target });

    expect(caster.buffs.getAllBuffIds()).toContain('self_haste');
    expect(target.buffs.getAllBuffIds()).not.toContain('self_haste');
  });

  it('buff copy can copy an incoming debuff back to the event source', () => {
    const source = createUnit('source');
    const owner = createUnit('owner');
    const incoming = new Buff('curse', '咒', BuffType.DEBUFF, 2, StackRule.OVERRIDE);
    incoming.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);

    const event: BuffAddEvent = {
      type: 'BuffAddEvent',
      timestamp: Date.now(),
      source,
      target: owner,
      buff: incoming,
    };

    new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
      target: 'caster',
    }).execute({ caster: source, target: owner, triggerEvent: event });

    expect(source.buffs.getAllBuffIds()).toContain('curse');
    expect(owner.buffs.getAllBuffIds()).not.toContain('curse');
  });

  it('buff copy can replay the latest dispelled matching debuff', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const curse = new Buff('old_curse', '旧咒', BuffType.DEBUFF, 2, StackRule.OVERRIDE);
    curse.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(curse, caster);
    target.buffs.removeBuffDispel('old_curse');

    new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
      target: 'target',
      replayRemoved: true,
    }).execute({ caster, target });

    expect(target.buffs.getAllBuffIds()).toContain('old_curse');
  });

  it('buff copy replayRemoved ignores active buffs and only replays dispelled history', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const activeCurse = new Buff('active_curse', '现咒', BuffType.DEBUFF, 2, StackRule.OVERRIDE);
    activeCurse.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(activeCurse, caster);

    new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
      target: 'caster',
      replayRemoved: true,
    }).execute({ caster, target });

    expect(caster.buffs.getAllBuffIds()).not.toContain('active_curse');
  });

  it('buff copy preserves data-driven buff runtime layers and remaining duration', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const sourceBuff = BuffFactory.create({
      id: 'layered_curse',
      name: '层咒',
      type: BuffType.DEBUFF,
      duration: 4,
      stackRule: StackRule.STACK_LAYER,
      tags: [GameplayTags.BUFF.TYPE.DEBUFF],
    });
    sourceBuff.setLayer(3);
    target.buffs.addBuff(sourceBuff, caster);
    sourceBuff.tickDuration();
    target.buffs.removeBuffDispel('layered_curse');

    new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
      target: 'target',
      replayRemoved: true,
    }).execute({ caster, target });

    const replayed = target.buffs.getAllBuffs().find((buff) => buff.id === 'layered_curse');
    expect(replayed?.getLayer()).toBe(3);
    expect(replayed?.getDuration()).toBe(3);
  });

  it('buff copy can be limited to the first incoming buff and avoids self-copy recursion', () => {
    const owner = createUnit('owner');
    const effect = new BuffCopyEffect({
      id: 'first_buff_only',
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
      durationDelta: 1,
      maxTriggers: 1,
    });
    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      effect.execute({ caster: owner, target: owner, triggerEvent: event });
    });

    const first = new Buff('first_blessing', '初佑', BuffType.BUFF, 2, StackRule.OVERRIDE);
    first.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);
    const second = new Buff('second_blessing', '再佑', BuffType.BUFF, 2, StackRule.OVERRIDE);
    second.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

    owner.buffs.addBuff(first, owner);
    owner.buffs.addBuff(second, owner);

    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === 'first_blessing')?.getMaxDuration()).toBe(3);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === 'second_blessing')?.getMaxDuration()).toBe(2);
  });

  it('buff copy recursion guard is scoped to the receiving unit runtime state', () => {
    const battleOneOwner = createUnit('same-owner-id');
    const battleOneTarget = createUnit('battle-one-target');
    const battleTwoOwner = createUnit('same-owner-id');
    const battleOneEffect = new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
    });
    const battleTwoEffect = new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
      maxTriggers: 1,
    });
    let insideBattleOneCopy = false;

    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      if (event.target !== battleOneTarget) return;

      insideBattleOneCopy = true;
      try {
        battleOneEffect.execute({
          caster: battleOneOwner,
          target: battleOneTarget,
          triggerEvent: event,
        });
      } finally {
        insideBattleOneCopy = false;
      }
    });
    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      if (!insideBattleOneCopy) return;

      battleTwoEffect.execute({
        caster: battleTwoOwner,
        target: battleTwoOwner,
        triggerEvent: event,
      });
    });

    const blessing = new Buff('shared_blessing', '同名赐福', BuffType.BUFF, 2, StackRule.OVERRIDE);
    blessing.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);
    battleOneTarget.buffs.addBuff(blessing, battleOneOwner);

    expect(battleOneOwner.buffs.getAllBuffIds()).toContain('shared_blessing');
    expect(battleTwoOwner.buffs.getAllBuffIds()).toContain('shared_blessing');
  });

  it('next hit rule applies to the caster rather than the current target', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'next_hit_target',
      name: '下一击目标',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new NextHitRuleEffect({ forceCritical: true, triggers: 1 }).execute({ caster, target });
    new DamageEffect({
      value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
    }).execute({ caster, target, ability: skill });

    expect(requests[0].isCritical).toBe(true);
  });

  it('turn state counter for no-damage resets when owner dealt damage', () => {
    const owner = createUnit('owner');
    const target = createUnit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    const counter = new TurnStateCounterEffect({
      key: 'idle',
      event: 'no_damage_dealt',
      threshold: 2,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    });

    counter.execute({ caster: owner, target });
    markDamageDealt(owner);
    counter.execute({
      caster: owner,
      target,
      triggerEvent: {
        type: 'RoundPreEvent',
        timestamp: Date.now(),
        turn: 2,
      } satisfies RoundPreEvent,
    });
    counter.execute({ caster: owner, target });

    expect(requests).toHaveLength(0);
    counter.execute({ caster: owner, target });
    expect(requests).toHaveLength(1);
  });

  it('element history triggers only after distinct ability elements', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const createSkill = (id: string, element: string) =>
      AbilityFactory.create({
        slug: id,
        name: id,
        type: AbilityType.ACTIVE_SKILL,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
          element,
        ],
        effects: [],
      });
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });
    const effect = new ElementHistoryEffect({
      key: 'elements',
      threshold: 3,
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
          },
        },
      ],
    });

    effect.execute({ caster, target, ability: createSkill('fire', GameplayTags.ABILITY.ELEMENT.FIRE) });
    effect.execute({ caster, target, ability: createSkill('fire2', GameplayTags.ABILITY.ELEMENT.FIRE) });
    effect.execute({ caster, target, ability: createSkill('ice', GameplayTags.ABILITY.ELEMENT.ICE) });
    expect(requests).toHaveLength(0);
    effect.execute({ caster, target, ability: createSkill('thunder', GameplayTags.ABILITY.ELEMENT.THUNDER) });
    expect(requests).toHaveLength(1);
  });

  it('damage defer reduces current damage and creates delayed damage buff', () => {
    const attacker = createUnit('attacker');
    const defender = createUnit('defender');
    const event: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      finalDamage: Math.round(defender.getMaxHp() * 0.3),
      damageType: DamageType.MAGICAL,
    };

    new DamageDeferEffect({
      ratio: 0.5,
      delayTurns: 2,
      thresholdMaxHpRatio: 0.25,
    }).execute({ caster: defender, target: defender, triggerEvent: event });

    expect(event.finalDamage).toBe(Math.round(defender.getMaxHp() * 0.15));
    expect(defender.buffs.getAllBuffs().some((buff) => buff.name === '延迟伤害')).toBe(true);
  });

  it('damage defer creates distinct delayed buffs under the same timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    const attacker = createUnit('attacker');
    const defender = createUnit('defender');
    const createEvent = (): DamageEvent => ({
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      finalDamage: 100,
      damageType: DamageType.MAGICAL,
    });
    const effect = new DamageDeferEffect({
      ratio: 0.5,
      delayTurns: 2,
    });

    effect.execute({ caster: defender, target: defender, triggerEvent: createEvent() });
    effect.execute({ caster: defender, target: defender, triggerEvent: createEvent() });

    expect(defender.buffs.getAllBuffIds().filter((id) => id.startsWith('deferred_damage_'))).toEqual([
      'deferred_damage_1',
      'deferred_damage_2',
    ]);
  });

  it('ability lock increases cooldown on the highest-cooldown matching skills and logs it', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const low = AbilityFactory.create({
      slug: 'low_cd',
      name: '低冷却',
      type: AbilityType.ACTIVE_SKILL,
      cooldown: 1,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.ELEMENT.FIRE,
      ],
      effects: [
        {
          type: 'damage',
          params: { value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 } },
        },
      ],
    }) as ActiveSkill;
    const high = AbilityFactory.create({
      slug: 'high_cd',
      name: '高冷却',
      type: AbilityType.ACTIVE_SKILL,
      cooldown: 3,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.ELEMENT.THUNDER,
      ],
      effects: [
        {
          type: 'damage',
          params: { value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 } },
        },
      ],
    }) as ActiveSkill;
    target.abilities.addAbility(low);
    target.abilities.addAbility(high);
    const cooldownEvents: CooldownModifyEvent[] = [];
    EventBus.instance.subscribe<CooldownModifyEvent>('CooldownModifyEvent', (event) => {
      cooldownEvents.push(event);
    });

    new AbilityLockEffect({ rounds: 1, maxCount: 1 }).execute({ caster, target });

    expect(high.currentCooldown).toBe(1);
    expect(low.currentCooldown).toBe(0);
    expect(cooldownEvents).toHaveLength(1);
    expect(cooldownEvents[0].affectedAbilityName).toBe('高冷却');
  });

  it('hp sacrifice damage emits both mechanic log and damage request', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mechanics: MechanicLogEvent[] = [];
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<MechanicLogEvent>('MechanicLogEvent', (event) => {
      mechanics.push(event);
    });
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      requests.push(event);
    });

    new HpSacrificeDamageEffect({
      hpRatio: 0.1,
      damagePerHp: 2,
    }).execute({ caster, target });

    expect(mechanics).toHaveLength(1);
    expect(mechanics[0]).toMatchObject({
      mechanic: 'hp_sacrifice',
      target: caster,
      value: Math.round(caster.getMaxHp() * 0.1),
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(Math.round((mechanics[0].value ?? 0) * 2));
  });
});
