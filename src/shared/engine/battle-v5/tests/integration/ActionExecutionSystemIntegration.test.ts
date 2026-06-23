import { ActiveSkill } from '../../abilities/ActiveSkill';
import { ELEMENT_TO_RUNTIME_ABILITY_TAG, GameplayTags } from '@shared/engine/shared/tag-domain';
import { Buff, StackRule } from '../../buffs/Buff';
import {
  AbilityId,
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { EventBus } from '../../core/EventBus';
import {
  ControlResistEvent,
  DamageRequestEvent,
  HitCheckEvent,
  SkillCastEvent,
  SkillPreCastEvent,
} from '../../core/events';
import { DamageEffect } from '../../effects/DamageEffect';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { DamageSystem } from '../../systems/DamageSystem';
import { LogAggregator } from '../../systems/log/LogAggregator';
import { LogCollector } from '../../systems/log/LogCollector';
import { Unit } from '../../units/Unit';
import { vi } from 'vitest';

class TrackingSkill extends ActiveSkill {
  public executeCount = 0;

  constructor() {
    super('tracking_skill' as AbilityId, '追踪术', {
      mpCost: 40,
      cooldown: 2,
    });
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {
    this.executeCount++;
  }
}

describe('ActionExecutionSystem integration', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('missed skill casts should still consume mp and enter cooldown, but skip effects', () => {
    const actionExecutionSystem = new ActionExecutionSystem();
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const skill = new TrackingSkill();
    const initialMp = caster.getCurrentMp();

    let interceptedSkillCast = false;
    EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => {
      interceptedSkillCast = true;
      event.isHit = false;
      event.isDodged = true;
    });

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(interceptedSkillCast).toBe(true);
    expect(skill.executeCount).toBe(0);
    expect(caster.getCurrentMp()).toBe(initialMp - 40);
    expect(skill.currentCooldown).toBe(2);

    actionExecutionSystem.destroy();
  });

  it('cooldown modification should stay on integral turn boundaries', () => {
    const skill = new TrackingSkill();

    skill.startCooldown();
    skill.modifyCooldown(-0.8);
    expect(skill.currentCooldown).toBe(1);

    skill.modifyCooldown(0.8);
    expect(skill.currentCooldown).toBe(2);

    skill.modifyCooldown(-1.2);
    expect(skill.currentCooldown).toBe(1);

    skill.tickCooldown();
    expect(skill.currentCooldown).toBe(0);
    expect(skill.isReady()).toBe(true);
  });
});

describe('DamageSystem hit check', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function publishSkillCast(caster: Unit, target: Unit): HitCheckEvent {
    const damageSystem = new DamageSystem();
    const skill = new TrackingSkill();
    let hitCheckEvent: HitCheckEvent | undefined;

    EventBus.instance.subscribe<HitCheckEvent>('HitCheckEvent', (event) => {
      hitCheckEvent = event;
    });

    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    damageSystem.destroy();
    expect(hitCheckEvent).toBeDefined();
    return hitCheckEvent!;
  }

  it('caps final dodge chance at 45%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const caster = new Unit('caster', '施法者', {
      [AttributeType.WISDOM]: 0,
      [AttributeType.WILLPOWER]: 0,
    });
    const target = new Unit('target', '目标', {
      [AttributeType.SPEED]: 3000,
    });
    target.attributes.addModifier({
      id: 'large_evasion_bonus',
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.FIXED,
      value: 0.4,
      source: 'test',
    });

    const hitCheckEvent = publishSkillCast(caster, target);

    expect(hitCheckEvent.isDodged).toBe(false);
    expect(hitCheckEvent.isHit).toBe(true);
  });

  it('keeps a 3% minimum dodge chance when accuracy exceeds evasion', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.02);
    const caster = new Unit('caster', '施法者', {
      [AttributeType.WISDOM]: 3000,
      [AttributeType.WILLPOWER]: 3000,
    });
    const target = new Unit('target', '目标', {
      [AttributeType.SPEED]: 0,
    });

    const hitCheckEvent = publishSkillCast(caster, target);

    expect(hitCheckEvent.isDodged).toBe(true);
    expect(hitCheckEvent.isHit).toBe(false);
  });

  it('skips dodge checks for self-targeted casts', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const caster = new Unit('caster', '施法者', {
      [AttributeType.SPEED]: 3000,
    });
    caster.attributes.addModifier({
      id: 'large_self_evasion_bonus',
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.FIXED,
      value: 0.4,
      source: 'test',
    });

    const hitCheckEvent = publishSkillCast(caster, caster);

    expect(hitCheckEvent.isDodged).toBe(false);
    expect(hitCheckEvent.isHit).toBe(true);
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('control resistance should not block damage effects on mixed skills', () => {
    const actionExecutionSystem = new ActionExecutionSystem();
    const damageSystem = new DamageSystem();
    const caster = new Unit('caster', '施法者', {
      [AttributeType.WILLPOWER]: 0,
      [AttributeType.WISDOM]: 0,
    });
    const target = new Unit('target', '目标', {
      [AttributeType.WILLPOWER]: 3000,
      [AttributeType.SPEED]: 0,
    });
    const initialHp = target.getCurrentHp();
    const resistedEvents: ControlResistEvent[] = [];

    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5);

    EventBus.instance.subscribe<ControlResistEvent>(
      'ControlResistEvent',
      (event) => resistedEvents.push(event),
    );

    const stunBuff = {
      id: 'mixed_stun',
      name: '定身',
      type: BuffType.CONTROL,
      duration: 2,
      stackRule: StackRule.OVERRIDE,
      tags: [GameplayTags.BUFF.TYPE.CONTROL],
      statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
    };
    const skill = AbilityFactory.create({
      slug: 'mixed_damage_control',
      name: '雷锁',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.FUNCTION.CONTROL,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'damage',
          params: { value: { base: 100, attribute: AttributeType.MAGIC_ATK } },
        },
        { type: 'apply_buff', params: { buffConfig: stunBuff } },
      ],
    });

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(target.getCurrentHp()).toBeLessThan(initialHp);
    expect(target.buffs.getAllBuffIds()).not.toContain('mixed_stun');
    expect(resistedEvents).toHaveLength(1);
    expect(randomSpy).toHaveBeenCalled();

    damageSystem.destroy();
    actionExecutionSystem.destroy();
  });

  it('pure control resistance should consume resources and cooldown without applying control', () => {
    const actionExecutionSystem = new ActionExecutionSystem();
    const caster = new Unit('caster', '施法者', {
      [AttributeType.WILLPOWER]: 0,
      [AttributeType.WISDOM]: 0,
    });
    const target = new Unit('target', '目标', {
      [AttributeType.WILLPOWER]: 3000,
      [AttributeType.SPEED]: 0,
    });
    const initialMp = caster.getCurrentMp();

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const skill = AbilityFactory.create({
      slug: 'pure_control',
      name: '束魂',
      type: AbilityType.ACTIVE_SKILL,
      mpCost: 30,
      cooldown: 2,
      tags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: 'pure_control_buff',
              name: '束魂',
              type: BuffType.CONTROL,
              duration: 2,
              stackRule: StackRule.OVERRIDE,
              tags: [GameplayTags.BUFF.TYPE.CONTROL],
              statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
            },
          },
        },
      ],
    });

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(caster.getCurrentMp()).toBe(initialMp - 30);
    expect((skill as ActiveSkill).currentCooldown).toBe(2);
    expect(target.buffs.getAllBuffIds()).not.toContain('pure_control_buff');

    actionExecutionSystem.destroy();
  });

  it('control resistance should be collected as a resist log entry', () => {
    const actionExecutionSystem = new ActionExecutionSystem();
    const aggregator = new LogAggregator();
    const collector = new LogCollector(aggregator);
    collector.subscribe(EventBus.instance);

    const caster = new Unit('caster', '施法者', {
      [AttributeType.WILLPOWER]: 0,
      [AttributeType.WISDOM]: 0,
    });
    const target = new Unit('target', '目标', {
      [AttributeType.WILLPOWER]: 3000,
      [AttributeType.SPEED]: 0,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const skill = AbilityFactory.create({
      slug: 'logged_control',
      name: '摄魂',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: 'logged_control_buff',
              name: '摄魂',
              type: BuffType.CONTROL,
              duration: 2,
              stackRule: StackRule.OVERRIDE,
              tags: [GameplayTags.BUFF.TYPE.CONTROL],
              statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
            },
          },
        },
      ],
    });

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    const entries = aggregator.getSpans().flatMap((span) => span.entries);
    expect(entries.some((entry) => entry.type === 'resist')).toBe(true);

    collector.unsubscribe(EventBus.instance);
    actionExecutionSystem.destroy();
  });
});

describe('DamageSystem direct mitigation', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createElementalAbility(
    slug: string,
    element: '火' | '水' | '木' | '土' | '金' | '风' | '雷' | '冰',
  ) {
    return AbilityFactory.create({
      slug,
      name: `${element}系术法`,
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
        ELEMENT_TO_RUNTIME_ABILITY_TAG[element],
      ],
      effects: [],
    });
  }

  function mockDeterministicDamageRolls() {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5);
  }

  it('direct damage effects should publish direct source so defenses reduce damage', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});

    defender.attributes.addModifier({
      id: 'def_bonus',
      attrType: AttributeType.DEF,
      type: ModifierType.FIXED,
      value: 20,
      source: 'test',
    });
    defender.updateDerivedStats();

    const receivedRequests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      receivedRequests.push({ ...event });
    });

    const damageEffect = new DamageEffect({
      value: {
        base: 100,
      },
    });

    damageEffect.execute({
      caster: attacker,
      target: defender,
    });

    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].damageSource).toBe(DamageSource.DIRECT);
    expect(receivedRequests[0].finalDamage).toBeLessThan(100);

    damageSystem.destroy();
  });

  it('elemental damage should gain bonus from matching spiritual root strength', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([{ element: '火', strength: 80, grade: '真灵根' }]);

    mockDeterministicDamageRolls();

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: createElementalAbility('fire-hit', '火'),
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(116);

    damageSystem.destroy();
  });

  it('elemental damage should be reduced when caster has no matching spiritual root', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([{ element: '水', strength: 90, grade: '真灵根' }]);

    mockDeterministicDamageRolls();

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: createElementalAbility('fire-hit', '火'),
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(85);

    damageSystem.destroy();
  });

  it('damage without elemental tags should ignore spiritual root modifiers', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([{ element: '火', strength: 100, grade: '天灵根' }]);

    mockDeterministicDamageRolls();

    const ability = AbilityFactory.create({
      slug: 'plain-true-hit',
      name: '无属性一击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      effects: [],
    });

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(100);

    damageSystem.destroy();
  });

  it('multi-element damage should use the strongest matching spiritual root', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([
      { element: '火', strength: 40, grade: '真灵根' },
      { element: '雷', strength: 95, grade: '变异灵根' },
    ]);

    mockDeterministicDamageRolls();

    const ability = AbilityFactory.create({
      slug: 'dual-element-hit',
      name: '双相灵击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
        ELEMENT_TO_RUNTIME_ABILITY_TAG['火'],
        ELEMENT_TO_RUNTIME_ABILITY_TAG['雷'],
      ],
      effects: [],
    });

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(119);

    damageSystem.destroy();
  });

  it('reflect damage should not receive spiritual root resonance', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([{ element: '火', strength: 100, grade: '天灵根' }]);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: createElementalAbility('fire-reflect', '火'),
      damageSource: DamageSource.REFLECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(100);

    damageSystem.destroy();
  });

  it('elemental buff tags should also trigger spiritual root resonance for non-skill damage', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});
    attacker.setSpiritualRoots([{ element: '火', strength: 80, grade: '真灵根' }]);

    const sourceBuff = new Buff(
      'fire-dot' as AbilityId,
      '灼烧',
      BuffType.DEBUFF,
      2,
      StackRule.REFRESH_DURATION,
    );
    sourceBuff.tags.addTags([ELEMENT_TO_RUNTIME_ABILITY_TAG['火']]);

    mockDeterministicDamageRolls();

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      buff: sourceBuff,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(116);

    damageSystem.destroy();
  });

  it('AbilityFactory should reject hand-authored active skills with incomplete tags', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'auto_magic_strike',
        name: '自适应灵击',
        type: AbilityType.ACTIVE_SKILL,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 30,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.8,
              },
            },
          },
        ],
      }),
    ).toThrow('[AbilityFactory] ability auto_magic_strike is missing required tags');
  });

  it('AbilityFactory should accept hand-authored active skills with explicit tags', () => {
    const ability = AbilityFactory.create({
      slug: 'explicit_magic_strike',
      name: '明示灵击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 30,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0.8,
            },
          },
        },
      ],
    });

    expect(ability.tags.hasTag(GameplayTags.ABILITY.FUNCTION.DAMAGE)).toBe(
      true,
    );
    expect(ability.tags.hasTag(GameplayTags.ABILITY.CHANNEL.MAGIC)).toBe(true);
  });

  it('AbilityFactory should reject damage abilities missing a damage channel tag', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'missing_damage_channel',
        name: '缺失通道标签',
        type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.6,
              },
            },
          },
        ],
      }),
    ).toThrow(
      `[AbilityFactory] ability missing_damage_channel must include ${GameplayTags.ABILITY.CHANNEL.MAGIC}`,
    );
  });

  it('AbilityFactory should reject abilities that mix physical and magical damage channels', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'mixed_damage_channels',
        name: '双通道冲突',
        type: AbilityType.ACTIVE_SKILL,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.6,
              },
            },
          },
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.ATK,
                coefficient: 0.6,
              },
            },
          },
        ],
      }),
    ).toThrow('[AbilityFactory] ability mixed_damage_channels mixes multiple damage channels');
  });

  it('AbilityFactory should reject abilities that mix true and magical damage channels', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'mixed_true_magic_damage_channels',
        name: '真法双通道冲突',
        type: AbilityType.ACTIVE_SKILL,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
          GameplayTags.ABILITY.CHANNEL.TRUE,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.6,
              },
            },
          },
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.WILLPOWER,
                coefficient: 0.6,
              },
              damageType: DamageType.TRUE,
            },
          },
        ],
      }),
    ).toThrow(
      '[AbilityFactory] ability mixed_true_magic_damage_channels mixes multiple damage channels',
    );
  });
});
