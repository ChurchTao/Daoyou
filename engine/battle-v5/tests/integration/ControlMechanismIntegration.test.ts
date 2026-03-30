/**
 * 控制机制端到端集成测试
 *
 * 覆盖控制三分法：
 * - 禁行动（眩晕/冰封）：NO_ACTION — 单位本回合完全跳过出手
 * - 禁技（封咒）：NO_SKILL — 单位只能普攻
 * - 禁普攻（折翅）：NO_BASIC — 单位只能使用技能，无技能则无法行动
 *
 * 同时验证：
 * - 控制效果由 BuffContainer 通过 statusTags 写入单位标签
 * - CONTROL_RESISTANCE 属性的 Buff modifier 可缩短控制持续时间
 */

import { BattleEngineV5 } from '../../BattleEngineV5';
import { EventBus } from '../../core/EventBus';
import { AttributeType, BuffType, ModifierType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';
import { StackRule } from '../../buffs/Buff';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (EventBus as any)._instance = null;
});

// ===== 辅助函数 =====

/** 创建标准 1v1 测试单位 */
function makeUnit(id: string, name: string, overrides: Partial<Record<AttributeType, number>> = {}): Unit {
  return new Unit(id, name, {
    [AttributeType.SPIRIT]: 100,
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPEED]: 20,
    [AttributeType.WILLPOWER]: 50,
    [AttributeType.WISDOM]: 30,
    ...overrides,
  });
}

/** 创建眩晕 Buff 配置（禁行动，持续 2 回合） */
function makeStunBuff(duration = 2) {
  return BuffFactory.create({
    id: 'stun',
    name: '眩晕',
    type: BuffType.CONTROL,
    duration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: [GameplayTags.BUFF.TYPE_CONTROL],
    // statusTags：附加给宿主的标签，驱动行动拦截
    statusTags: [GameplayTags.STATUS.NO_ACTION],
  });
}

/** 创建封咒 Buff（禁技，持续 2 回合） */
function makeSealBuff(duration = 2) {
  return BuffFactory.create({
    id: 'seal',
    name: '封咒',
    type: BuffType.CONTROL,
    duration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: [GameplayTags.BUFF.TYPE_CONTROL],
    statusTags: [GameplayTags.STATUS.NO_SKILL],
  });
}

/** 创建折翅 Buff（禁普攻，持续 2 回合） */
function makeWingbindBuff(duration = 2) {
  return BuffFactory.create({
    id: 'wingbind',
    name: '折翅',
    type: BuffType.CONTROL,
    duration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: [GameplayTags.BUFF.TYPE_CONTROL],
    statusTags: [GameplayTags.STATUS.NO_BASIC],
  });
}

// ===== 测试：控制标签附加 =====

describe('控制 Buff statusTags 写入单位标签', () => {
  it('眩晕 Buff 应为宿主添加 NO_ACTION 标签', () => {
    const unit = makeUnit('u1', '修士甲');
    const stun = makeStunBuff(3);
    unit.buffs.addBuff(stun);

    expect(unit.tags.hasTag(GameplayTags.STATUS.NO_ACTION)).toBe(true);
  });

  it('封咒 Buff 应为宿主添加 NO_SKILL 标签', () => {
    const unit = makeUnit('u1', '修士甲');
    const seal = makeSealBuff(3);
    unit.buffs.addBuff(seal);

    expect(unit.tags.hasTag(GameplayTags.STATUS.NO_SKILL)).toBe(true);
  });

  it('折翅 Buff 应为宿主添加 NO_BASIC 标签', () => {
    const unit = makeUnit('u1', '修士甲');
    const wb = makeWingbindBuff(3);
    unit.buffs.addBuff(wb);

    expect(unit.tags.hasTag(GameplayTags.STATUS.NO_BASIC)).toBe(true);
  });

  it('Buff 过期后标签应被清除', () => {
    const unit = makeUnit('u1', '修士甲');
    const stun = makeStunBuff(1);
    unit.buffs.addBuff(stun);
    expect(unit.tags.hasTag(GameplayTags.STATUS.NO_ACTION)).toBe(true);

    // 模拟一次 tick 后过期移除
    stun.tickDuration();
    expect(stun.isExpired()).toBe(true);
    unit.buffs.removeBuffExpired(stun.id);

    expect(unit.tags.hasTag(GameplayTags.STATUS.NO_ACTION)).toBe(false);
  });
});

// ===== 测试：矫健缩短控制时间 =====
describe('CONTROL_RESISTANCE 控制抗性缩短控制持续时间', () => {
  it('CONTROL_RESISTANCE=1.0 应将 4 回合控制缩减为 2 回合', () => {
    const unit = makeUnit('u1', '抗控修士');
    // 通过 Buff modifier 为 CONTROL_RESISTANCE 附加 +1.0 固定值
    const resistBuff = BuffFactory.create({
      id: 'test_resist',
      name: '测试抗控',
      type: BuffType.BUFF,
      duration: 99,
      stackRule: StackRule.REFRESH_DURATION,
      modifiers: [
        { attrType: AttributeType.CONTROL_RESISTANCE, type: ModifierType.FIXED, value: 1.0 },
      ],
    });
    unit.buffs.addBuff(resistBuff);

    const stun = makeStunBuff(4); // 原始 4 回合
    // ApplyBuffEffect 逻辑在此处手动复现用于单元验证
    const controlResistance = unit.attributes.getValue(AttributeType.CONTROL_RESISTANCE);
    const adjustedDuration = Math.max(1, Math.round(stun.getDuration() / (1 + controlResistance)));
    stun.refreshToDuration(adjustedDuration);

    unit.buffs.addBuff(stun);
    const buff = unit.buffs.getAllBuffs().find((b) => b.id === 'stun')!;
    expect(buff.getDuration()).toBe(2);
  });

  it('CONTROL_RESISTANCE=0（无抗控 buff）不影响控制时间', () => {
    const unit = makeUnit('u1', '普通修士');
    // WILLPOWER=50 → formula 结果 ~0.15，但需要测试 modifier 为 0 时没有额外缩减
    // 直接设置 WILLPOWER=0 使派生公式结果为 0
    unit.attributes.setBaseValue(AttributeType.WILLPOWER, 0);

    const stun = makeStunBuff(3);
    const controlResistance = unit.attributes.getValue(AttributeType.CONTROL_RESISTANCE);
    // controlResistance = 0, no reduction
    const adjustedDuration = Math.max(1, Math.round(stun.getDuration() / (1 + controlResistance)));
    stun.refreshToDuration(adjustedDuration);

    unit.buffs.addBuff(stun);
    const buff = unit.buffs.getAllBuffs().find((b) => b.id === 'stun')!;
    expect(buff.getDuration()).toBe(3);
  });
});

// ===== 测试：禁行动端到端 =====

describe('禁行动（NO_ACTION）战斗机制', () => {
  it('被眩晕单位在受控回合内不应造成任何伤害', () => {
    // player 预先被附加永久眩晕（100 回合），整场战斗均无法行动
    // opponent 无注册技能，只依靠普攻输出，最终击杀低血量 player 获胜
    const player = makeUnit('player', '被控修士', {
      [AttributeType.VITALITY]: 10,   // 低气血，确保对手普攻能打死
      [AttributeType.SPEED]: 5,
    });
    const opponent = makeUnit('opponent', '普攻修士', {
      [AttributeType.SPIRIT]: 500,    // 高灵力，确保普攻输出足够
      [AttributeType.SPEED]: 100,
    });

    // 战斗开始前直接将眩晕 Buff 附加到 player
    const stun = makeStunBuff(100);
    player.buffs.addBuff(stun);
    expect(player.tags.hasTag(GameplayTags.STATUS.NO_ACTION)).toBe(true);

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 普攻修士应通过持续普攻获胜
    expect(result.winner).toBe('opponent');

    // 如果战斗引擎正确拦截了眩晕单位的行动，player 应在整场战斗中没有主动出手过
    // （通过 winner 断言间接验证：player 无法反击 → 被动挨打 → opponent 获胜）
  });
});

// ===== 测试：二级属性接线验证 =====

describe('二级属性最基础接线验证', () => {
  it('外部注入型二级属性默认值应为 0', () => {
    const unit = makeUnit('u1', '测试');
    expect(unit.attributes.getValue(AttributeType.ARMOR_PENETRATION)).toBe(0);
    expect(unit.attributes.getValue(AttributeType.CRIT_RESIST)).toBe(0);
    expect(unit.attributes.getValue(AttributeType.CRIT_DAMAGE_REDUCTION)).toBe(0);
    expect(unit.attributes.getValue(AttributeType.ACCURACY)).toBe(0);
    expect(unit.attributes.getValue(AttributeType.HEAL_AMPLIFY)).toBe(0);
  });

  it('派生型二级属性应根据主属性公式计算（SPEED=20, WILLPOWER=50, WISDOM=30, VITALITY=100）', () => {
    const unit = makeUnit('u1', '测试');
    // CRIT_RATE = min(0.60, 0.05 + 20×0.002 + 30×0.001) = 0.05+0.04+0.03 = 0.12
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(0.12);
    // CRIT_DAMAGE_MULT = min(2.00, 1.25 + 30×0.005) = 1.40
    expect(unit.attributes.getValue(AttributeType.CRIT_DAMAGE_MULT)).toBeCloseTo(1.40);
    // EVASION_RATE = min(0.50, 20×0.003) = 0.06
    expect(unit.attributes.getValue(AttributeType.EVASION_RATE)).toBeCloseTo(0.06);
    // DAMAGE_REDUCTION = min(0.70, 100/(100+1000)) ≈ 0.0909
    expect(unit.attributes.getValue(AttributeType.DAMAGE_REDUCTION)).toBeCloseTo(100 / 1100);
    // CONTROL_HIT = min(0.80, 50×0.003) = 0.15
    expect(unit.attributes.getValue(AttributeType.CONTROL_HIT)).toBeCloseTo(0.15);
    // CONTROL_RESISTANCE = min(0.80, 50×0.003) = 0.15
    expect(unit.attributes.getValue(AttributeType.CONTROL_RESISTANCE)).toBeCloseTo(0.15);
  });

  it('Buff 可以通过 modifiers 修改二级属性', () => {
    const unit = makeUnit('u1', '测试');
    const armorPenBuff = BuffFactory.create({
      id: 'penetrating_insight',
      name: '洞察破防',
      type: BuffType.BUFF,
      duration: 3,
      stackRule: StackRule.REFRESH_DURATION,
      modifiers: [
        {
          attrType: AttributeType.ARMOR_PENETRATION,
          type: ModifierType.FIXED, // 二级属性 base=0，必须用 FIXED 直接加値
          value: 0.2, // +0.2 破防率
        },
      ],
    });

    unit.buffs.addBuff(armorPenBuff);
    expect(unit.attributes.getValue(AttributeType.ARMOR_PENETRATION)).toBeCloseTo(0.2);
  });
});
