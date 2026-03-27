import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '../../core/GameplayTags';
import { AttributeType, BuffType, DamageTakenEvent } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';

describe('V5 新增原子效果集成测试 (重构后)', () => {
  let player: Unit;
  let opponent: Unit;

  beforeEach(() => {
    EventBus.instance.reset();
    player = new Unit('player', '测试玩家', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
    });
    opponent = new Unit('opponent', '测试对手', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
    });
  });

  it('护盾效果 (ShieldEffect) 应该使用 ScalableValue 正确吸收伤害', () => {
    // 1. 使用新配置：100 基础 + 2倍灵力 (100*2) = 300 护盾
    const shieldEffect = AbilityFactory.createEffect({
      type: 'shield',
      params: {
        value: { base: 100, attribute: AttributeType.SPIRIT, coefficient: 2 },
      },
    });

    shieldEffect?.execute({ caster: player, target: player });
    expect(player.currentShield).toBe(300);

    // 2. 对手造成 200 点伤害
    player.absorbDamage(200);
    expect(player.currentShield).toBe(100);
  });

  it('条件检查 (Conditions) 应该正确过滤效果执行', () => {
    // 1. 只有当目标有 "Buff.Type.Debuff" 标签时才触发治疗
    const conditionalHeal = AbilityFactory.createEffect({
      type: 'heal',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.BUFF.TYPE_DEBUFF } },
      ],
      params: { value: { base: 100 } },
    });

    player.takeDamage(150);
    const hpBefore = player.currentHp;

    // 2. 第一次执行：目标没标签，不应该治疗
    conditionalHeal?.execute({ caster: player, target: player });
    expect(player.currentHp).toBe(hpBefore);

    // 3. 给玩家加个 Debuff 标签
    player.tags.addTags([GameplayTags.BUFF.TYPE_DEBUFF]);

    // 4. 第二次执行：有标签，应该治疗
    conditionalHeal?.execute({ caster: player, target: player });
    expect(player.currentHp).toBe(hpBefore + 100);
  });

  it('概率条件 (Chance Condition) 应该起作用', () => {
    const chanceEffect = AbilityFactory.createEffect({
      type: 'damage',
      conditions: [{ type: 'chance', params: { value: 0 } }], // 0% 概率
      params: { value: { base: 100 } },
    });

    chanceEffect?.execute({ caster: player, target: opponent });

    // 验证没有 DamageRequestEvent 发布
    const history = EventBus.instance.getEventHistory();
    expect(
      history.find((e) => e.type === 'DamageRequestEvent'),
    ).toBeUndefined();
  });

  it('吸血效果 (ResourceDrainEffect) 应该在重构后继续工作', () => {
    // 扣点血
    player.takeDamage(200);
    const hpAfterDamage = player.currentHp;

    const drainEffect = AbilityFactory.createEffect({
      type: 'resource_drain',
      params: { sourceType: 'hp', targetType: 'hp', ratio: 0.5 },
    });

    drainEffect?.execute({
      caster: player,
      target: opponent,
      triggerEvent: {
        type: 'DamageTakenEvent',
        damageTaken: 200,
      } as DamageTakenEvent,
    });

    // 应该回复 200 * 0.5 = 100 HP
    expect(player.currentHp).toBe(hpAfterDamage + 100);
  });

  it('驱散效果 (DispelEffect) 应该正确移除匹配标签的 Buff', () => {
    const poison = BuffFactory.create({
      id: 'poison',
      name: '毒',
      type: BuffType.DEBUFF,
      duration: 3,
      tags: [GameplayTags.BUFF.TYPE_DEBUFF],
      stackRule: 'stack_layer',
    });
    opponent.buffs.addBuff(poison);

    const dispel = AbilityFactory.createEffect({
      type: 'dispel',
      params: { targetTag: GameplayTags.BUFF.TYPE_DEBUFF, maxCount: 1 },
    });

    dispel?.execute({ caster: player, target: opponent });
    expect(opponent.buffs.getAllBuffIds()).not.toContain('poison');
  });

  it('反伤效果 (ReflectEffect) 不应对 reflect 来源伤害继续反弹', () => {
    const reflect = AbilityFactory.createEffect({
      type: 'reflect',
      params: { ratio: 1 },
    });

    reflect?.execute({
      caster: opponent,
      target: player,
      triggerEvent: {
        type: 'DamageTakenEvent',
        priority: 0,
        timestamp: Date.now(),
        caster: opponent,
        target: player,
        damageSource: 'reflect',
        damageTaken: 100,
        remainHealth: player.currentHp,
        isLethal: false,
      } as DamageTakenEvent,
    });

    const history = EventBus.instance.getEventHistory();
    expect(history.find((event) => event.type === 'DamageRequestEvent')).toBeUndefined();
  });
});
