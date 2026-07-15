import { BattleEngineV5 } from '../../BattleEngineV5';
import { EventBus } from '../../core/EventBus';
import type {
  ActionStateEvent,
  ControlledSkipEvent,
  DodgeEvent,
  HitCheckEvent,
  SkillPreCastEvent,
} from '../../core/events';
import {
  getActionStateViews,
  peekQueuedAction,
  queueSkippedActions,
} from '../../core/runtimeState';
import {
  AbilityType,
  AttributeType,
  BuffType,
  ModifierType,
} from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { Unit } from '../../units/Unit';
import { StackRule } from '../../buffs/Buff';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BLOCKING_TAGS = [
  GameplayTags.STATUS.CONTROL.STUNNED,
  GameplayTags.STATUS.CONTROL.NO_ACTION,
  GameplayTags.STATUS.CONTROL.NO_SKILL,
  GameplayTags.STATUS.CONTROL.NO_BASIC,
] as const;

function combatant(id: string, speed: number): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 10,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.WISDOM]: 10,
    [AttributeType.SPEED]: speed,
    [AttributeType.WILLPOWER]: 10,
  });
}

function chargedStrike(coefficient = 1_000) {
  return AbilityFactory.create({
    slug: 'test.charge',
    name: '藏锋',
    type: AbilityType.ACTIVE_SKILL,
    priority: 100,
    cooldown: 10,
    tags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [],
    castEffects: [{
      type: 'queue_action',
      params: {
        id: 'test.after-strike',
        name: '听雷沉山',
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        effects: [{
          type: 'damage',
          params: {
            value: { attribute: AttributeType.ATK, coefficient },
          },
        }],
        interruptPolicy: 'uninterruptible',
        hitPolicy: 'guaranteed',
      },
    }],
  });
}

describe('不可打断后发策略', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it.each(BLOCKING_TAGS)('%s不能阻止后发，调息保留且后发必然命中', (tag) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const actor = combatant('actor', 500);
    const target = combatant('target', 1);
    target.attributes.addModifier({
      id: 'target.guaranteed-dodge',
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.OVERRIDE,
      value: 1,
      source: 'test',
    });
    actor.abilities.addAbility(chargedStrike());

    const actionStates: ActionStateEvent[] = [];
    const hitChecks: HitCheckEvent[] = [];
    const controlledSkips: ControlledSkipEvent[] = [];
    const dodges: DodgeEvent[] = [];
    EventBus.instance.subscribe<ActionStateEvent>('ActionStateEvent', (event) => {
      actionStates.push(event);
      if (
        event.unit === actor &&
        event.stateType === 'queued_action' &&
        event.phase === 'entered'
      ) {
        actor.tags.addTags([tag]);
        queueSkippedActions(actor, 1, '测试调息', '调息');
      }
    });
    EventBus.instance.subscribe<HitCheckEvent>('HitCheckEvent', (event) => {
      if (event.ability.id === 'test.after-strike') hitChecks.push(event);
    });
    EventBus.instance.subscribe<ControlledSkipEvent>(
      'ControlledSkipEvent',
      (event) => controlledSkips.push(event),
    );
    EventBus.instance.subscribe<DodgeEvent>('DodgeEvent', (event) => {
      if (event.ability.id === 'test.after-strike') dodges.push(event);
    });

    const engine = new BattleEngineV5(actor, target);
    const result = engine.execute();
    engine.destroy();

    expect(result.winner).toBe(actor.id);
    expect(actionStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stateType: 'queued_action',
          phase: 'entered',
        }),
        expect.objectContaining({
          stateType: 'queued_action',
          phase: 'triggered',
        }),
      ]),
    );
    expect(actionStates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stateType: 'queued_action',
          phase: 'cancelled',
        }),
      ]),
    );
    expect(hitChecks).toHaveLength(1);
    expect(hitChecks[0]).toMatchObject({
      isHit: true,
      isDodged: false,
      hitPolicy: 'guaranteed',
    });
    expect(dodges).toHaveLength(0);
    expect(controlledSkips.some((event) => event.unit === actor)).toBe(false);
    expect(getActionStateViews(actor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'rest', remainingActions: 1 }),
      ]),
    );
    expect(
      result.logs.some((line) => line.includes('开始蓄势，下一行动将发动《听雷沉山》')),
      result.logs.join('\n'),
    ).toBe(true);
    expect(
      result.logs.some((line) => line.includes('蓄势完成，发动《听雷沉山》')),
      result.logs.join('\n'),
    ).toBe(true);
    expect(result.logs.join('\n')).not.toMatch(/强行|顶住|无视|蓄势被打断/);
  });

  it('施法打断监听器不能取消已登记的不可打断后发', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const actor = combatant('actor', 500);
    const target = combatant('target', 1);
    actor.abilities.addAbility(chargedStrike());
    const states: ActionStateEvent[] = [];
    EventBus.instance.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      (event) => {
        if (event.ability.id === 'test.after-strike') event.isInterrupted = true;
      },
      10_000,
    );
    EventBus.instance.subscribe<ActionStateEvent>(
      'ActionStateEvent',
      (event) => {
        states.push(event);
        if (event.stateType === 'queued_action' && event.phase === 'entered') {
          AbilityFactory.createEffect({
            type: 'ability_lock',
            params: { rounds: 3, maxCount: 1 },
          })?.execute({ caster: target, target: actor });
        }
      },
    );

    const engine = new BattleEngineV5(actor, target);
    const result = engine.execute();
    engine.destroy();

    expect(result.winner).toBe(actor.id);
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ stateType: 'queued_action', phase: 'triggered' }),
    ]));
    expect(states).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ stateType: 'queued_action', phase: 'cancelled' }),
    ]));
  });

  it('施法者在后发行动前死亡时不发动且不产生取消日志', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const actor = combatant('actor', 500);
    const target = combatant('target', 1);
    actor.abilities.addAbility(chargedStrike());
    target.abilities.addAbility(AbilityFactory.create({
      slug: 'test.execution',
      name: '处决',
      type: AbilityType.ACTIVE_SKILL,
      priority: 100,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.ATK, coefficient: 1_000 },
        },
      }],
    }));
    const states: ActionStateEvent[] = [];
    EventBus.instance.subscribe<ActionStateEvent>(
      'ActionStateEvent',
      (event) => states.push(event),
    );

    const engine = new BattleEngineV5(actor, target);
    const result = engine.execute();
    engine.destroy();

    expect(result.winner).toBe(target.id);
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ stateType: 'queued_action', phase: 'entered' }),
    ]));
    expect(states).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        stateType: 'queued_action',
        phase: expect.stringMatching(/triggered|cancelled/),
      }),
    ]));
    expect(result.logs.join('\n')).not.toMatch(/蓄势取消|蓄势被打断/);
    expect(peekQueuedAction(actor)).toBeUndefined();
  });

  it('持续两次自身行动的控制在后发后仍会阻止下一次普通行动', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const actor = combatant('actor', 500);
    const target = combatant('target', 1);
    actor.abilities.addAbility(chargedStrike(0.1));
    const sequence: string[] = [];
    EventBus.instance.subscribe<ActionStateEvent>(
      'ActionStateEvent',
      (event) => {
        if (event.unit !== actor || event.stateType !== 'queued_action') return;
        sequence.push(event.phase);
        if (event.phase === 'entered') {
          AbilityFactory.createEffect({
            type: 'apply_buff',
            params: {
              target: 'caster',
              buffConfig: {
                id: 'test.two-action-stun',
                name: '两次行动眩晕',
                type: BuffType.CONTROL,
                duration: 2,
                stackRule: StackRule.REFRESH_DURATION,
                tags: [
                  GameplayTags.BUFF.TYPE.CONTROL,
                ],
                statusTags: [GameplayTags.STATUS.CONTROL.STUNNED],
              },
            },
          })?.execute({ caster: actor, target: actor });
        }
      },
    );
    EventBus.instance.subscribe<ControlledSkipEvent>(
      'ControlledSkipEvent',
      (event) => {
        if (event.unit === actor) sequence.push('controlled_skip');
      },
    );

    const engine = new BattleEngineV5(actor, target);
    const result = engine.execute();
    engine.destroy();

    expect(sequence).toEqual(expect.arrayContaining(['entered', 'triggered']));
    expect(
      sequence.indexOf('controlled_skip'),
      `${sequence.join(',')}\n${result.logs.join('\n')}`,
    ).toBeGreaterThan(
      sequence.indexOf('triggered'),
    );
  });
});
