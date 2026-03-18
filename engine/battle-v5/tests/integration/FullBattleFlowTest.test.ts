// engine/battle-v5/tests/integration/FullBattleFlowTest.test.ts
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { BattleEngineV5 } from '../../BattleEngineV5';
import { EventBus } from '../../core/EventBus';
import { AttributeType } from '../../core/types';
import { Unit } from '../../units/Unit';

/**
 * High damage skill for testing lethal damage scenarios
 */
class HighDamageSkill extends ActiveSkill {
  constructor(id: string, name: string) {
    super(id, name, 0, 0); // mpCost, cooldown
    this.setDamageCoefficient(5.0);
    this.setBaseDamage(100);
    this.setIsMagicAbility(true);
    this.setManaCost(0);
    this.setPriority(10);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {
    // The actual damage is handled by the DamageSystem via events
    // This is just a placeholder for the skill effect
    // In the event-driven architecture, SkillCastEvent triggers DamageSystem
  }
}

describe('Full Battle Flow - EventDriven', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should execute complete battle with skill cast -> hit check -> damage apply', () => {
    // 创建两个属性差异明显的单位
    const attacker = new Unit('attacker', '攻击者', {
      [AttributeType.SPIRIT]: 200,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const defender = new Unit('defender', '防守者', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 30,
      [AttributeType.CONSCIOUSNESS]: 30,
      [AttributeType.COMPREHENSION]: 30,
    });

    // 添加高伤害技能
    const skill = new HighDamageSkill('ultimate', '必杀技');

    attacker.abilities.addAbility(skill);
    attacker.currentMp = 100;

    defender.abilities.addAbility(skill);
    defender.currentMp = 100;

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    // 验证战斗结果
    expect(result.turns).toBeGreaterThan(0);
    expect(result.winner).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(0);

    // 分析战报内容
    const allLogs = result.logs.join('\n');
    console.log('=== 完整战报 ===');
    console.log(allLogs);
    console.log('================');

    // 应该包含各种战斗事件
    expect(allLogs).toMatch(/回合|伤害|闪避|抵抗|击杀|阵亡/);
  });

  it('should handle lethal damage correctly', () => {
    // 高攻击 vs 低血量场景
    const attacker = new Unit('attacker', '攻击者', {
      [AttributeType.SPIRIT]: 200,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const defender = new Unit('defender', '防守者', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 30,
      [AttributeType.CONSCIOUSNESS]: 30,
      [AttributeType.COMPREHENSION]: 30,
    });

    const skill = new HighDamageSkill('strongAttack', '强力攻击');

    attacker.abilities.addAbility(skill);
    attacker.currentMp = 100;

    // 防守方没有技能，只能普攻
    defender.currentMp = 100;

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    // 验证击杀相关日志
    const allLogs = result.logs.join('\n');
    console.log('=== 完整战报 ===', allLogs);
    expect(allLogs).toMatch(/击杀|阵亡|击败|耗尽/);
  });
});
