import { BattleEngineV5 } from '../../BattleEngineV5';
import { GameplayTags } from '../../core';
import { EventBus } from '../../core/EventBus';
import { AbilityType, AttributeType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';

describe('战斗引擎 V5 原子效果集成测试', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (EventBus as any)._instance = null;
  });

  it('验证治疗效果 (HealEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 100,
    });
    const target = new Unit('target', '受治者', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 1,
    });

    target.takeDamage(500);
    const healAbility = AbilityFactory.create({
      slug: 'heal_skill',
      name: '回春术',
      type: AbilityType.ACTIVE_SKILL,
      targetPolicy: { team: 'self', scope: 'single' },
      cooldown: 2,
      effects: [
        {
          type: 'heal',
          params: {
            value: {
              base: 100,
              attribute: AttributeType.SPIRIT,
              coefficient: 1.0,
            },
          },
        },
      ],
    });
    player.abilities.addAbility(healAbility);

    const engine = new BattleEngineV5(player, target);
    const result = engine.execute();

    const healLogs = result.logs.filter((log) => log.includes('【治疗】'));
    expect(healLogs.length).toBeGreaterThan(0);
    expect(healLogs[0]).toContain('恢复了200点气血');
  });

  it('验证焚元效果 (ManaBurnEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.AGILITY]: 100,
    });
    const target = new Unit('target', '受害者', { [AttributeType.AGILITY]: 1 });

    const manaBurnAbility = AbilityFactory.create({
      slug: 'mana_burn_skill',
      name: '蚀元咒',
      type: AbilityType.ACTIVE_SKILL,
      effects: [
        {
          type: 'mana_burn',
          params: {
            value: {
              base: 50,
              attribute: AttributeType.SPIRIT,
              coefficient: 0.5,
            },
          },
        },
      ],
    });
    player.abilities.addAbility(manaBurnAbility);

    const engine = new BattleEngineV5(player, target);
    const result = engine.execute();
    console.log(result.logs);
    const manaBurnLogs = result.logs.filter((log) => log.includes('【焚元】'));
    expect(manaBurnLogs.length).toBeGreaterThan(0);
    expect(manaBurnLogs[0]).toContain('削减了受害者100点真元');
  });

  it('验证属性修改效果 (AttributeModEffect)', () => {
    const player = new Unit('player', '施法者', {
      [AttributeType.PHYSIQUE]: 100,
    });
    const target = new Unit('target', '受害者', {
      [AttributeType.PHYSIQUE]: 100,
    });

    const effect = AbilityFactory.createEffect({
      type: 'attribute_mod',
      params: {
        attrType: AttributeType.PHYSIQUE,
        modType: 'fixed' as any,
        value: -20,
      },
    });

    effect?.execute({ caster: player, target });
    expect(target.attributes.getValue(AttributeType.PHYSIQUE)).toBe(80);
  });

  it('验证护盾效果 (ShieldEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {
      [AttributeType.SPIRIT]: 100,
    });
    const target = new Unit('target', '受护者', {});

    const engine = new BattleEngineV5(player, target);

    const effect = AbilityFactory.createEffect({
      type: 'shield',
      params: {
        value: { base: 150, attribute: AttributeType.SPIRIT, coefficient: 1.0 },
      },
    });

    effect?.execute({ caster: player, target });
    expect(target.currentShield).toBe(250);

    const logs = engine.logSystem.getLogs();
    console.log(logs);
    expect(
      logs.some(
        (l) =>
          l.message.includes('【护盾】') &&
          l.message.includes('施加了250点护盾'),
      ),
    ).toBe(true);
  });

  it('验证冷却修改效果 (CooldownModifyEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {});
    const target = new Unit('target', '受影响者', {});

    const engine = new BattleEngineV5(player, target);

    const skill = AbilityFactory.create({
      slug: 'test_skill',
      name: '测试技能',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.ELEMENT_THUNDER],
      cooldown: 5,
    }) as any;
    target.abilities.addAbility(skill);
    skill.startCooldown();

    const effect = AbilityFactory.createEffect({
      type: 'cooldown_modify',
      params: {
        cdModifyValue: -3,
        tags: [GameplayTags.ABILITY.ELEMENT_THUNDER],
      },
    });

    effect?.execute({ caster: player, target });
    expect(skill.currentCooldown).toBe(2);

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【时序】') && l.message.includes('冷却减少3回合'),
      ),
    ).toBe(true);
  });

  it('验证驱散效果 (DispelEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {});
    const target = new Unit('target', '受洗者', {});

    const engine = new BattleEngineV5(player, target);

    const poison = BuffFactory.create({
      id: 'poison',
      name: '剧毒',
      type: 'debuff' as any,
      duration: 3,
      stackRule: 'stack_layer',
      tags: ['Status.Poisoned'],
    });
    target.buffs.addBuff(poison);

    const effect = AbilityFactory.createEffect({
      type: 'dispel',
      params: { targetTag: 'Status.Poisoned', maxCount: 1 },
    });

    effect?.execute({ caster: player, target });
    expect(target.buffs.getAllBuffIds()).not.toContain('poison');

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【驱散】') &&
          l.message.includes('清除了受洗者身上的「剧毒」'),
      ),
    ).toBe(true);
  });

  it('验证资源夺取效果 (ResourceDrainEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {});
    const target = new Unit('target', '受害者', {});

    const engine = new BattleEngineV5(player, target);
    player.takeDamage(100);

    const effect = AbilityFactory.createEffect({
      type: 'resource_drain',
      params: { sourceType: 'hp', targetType: 'hp', ratio: 0.5 },
    });

    effect?.execute({
      caster: player,
      target,
      triggerEvent: {
        type: 'DamageTakenEvent',
        caster: player,
        target,
        damageTaken: 100,
      } as any,
    });

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【掠夺】') &&
          l.message.includes('夺取了50点气血'),
      ),
    ).toBe(true);
  });

  it('验证反伤效果 (ReflectEffect) 和日志输出', () => {
    const player = new Unit('player', '攻击者', {});
    const target = new Unit('target', '反伤者', {});

    const engine = new BattleEngineV5(player, target);

    const effect = AbilityFactory.createEffect({
      type: 'reflect',
      params: { ratio: 0.5 },
    });

    effect?.execute({
      caster: target,
      target: player,
      triggerEvent: {
        type: 'DamageTakenEvent',
        caster: player,
        target,
        damageTaken: 200,
      } as any,
    });

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【反伤】') &&
          l.message.includes('将100点伤害反弹给了攻击者'),
      ),
    ).toBe(true);
  });

  it('验证免死效果 (DeathPreventEffect) 和日志输出', () => {
    const player = new Unit('player', '攻击者', {});
    const target = new Unit('target', '受击者', {});

    const engine = new BattleEngineV5(player, target);
    target.takeDamage(target.currentHp - 10);

    const effect = AbilityFactory.createEffect({
      type: 'death_prevent',
      params: {},
    });

    effect?.execute({
      caster: player,
      target,
      triggerEvent: {
        type: 'DamageTakenEvent',
        damageTaken: 100,
        isLethal: true,
      } as any,
    });

    expect(target.currentHp).toBe(1);

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【免死】') &&
          l.message.includes('在致命一击下保住了性命'),
      ),
    ).toBe(true);
  });

  it('验证标签触发效果 (TagTriggerEffect) 和日志输出', () => {
    const player = new Unit('player', '施法者', {
      [AttributeType.SPIRIT]: 100,
    });
    const target = new Unit('target', '受试者', {});

    const engine = new BattleEngineV5(player, target);
    target.tags.addTags(['Status.Marked']);

    const effect = AbilityFactory.createEffect({
      type: 'tag_trigger',
      params: {
        triggerTag: 'Status.Marked',
        damageRatio: 1.0,
        removeOnTrigger: true,
      },
    });

    effect?.execute({ caster: player, target });

    const logs = engine.logSystem.getLogs();
    expect(
      logs.some(
        (l) =>
          l.message.includes('【触发】') &&
          l.message.includes('触发了受试者身上的「Status.Marked」标记'),
      ),
    ).toBe(true);
    // 同时也应该有伤害日志 (50基础 + 100灵力*1.0 = 150，带随机浮动)
    expect(
      logs.some(
        (l) =>
          l.message.includes('【伤害】') &&
          l.message.includes('造成') &&
          l.message.includes('伤害'),
      ),
    ).toBe(true);
  });
});
