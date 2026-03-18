/**
 * 战斗机制可视化测试
 * 构建角色和技能，让 BattleEngineV5 自动执行，观察日志输出
 *
 * 测试场景：
 * 1. 基础战斗 - 验证伤害计算、回合流程
 * 2. 闪避机制 - 高身法单位触发闪避
 * 3. 控制抵抗 - 高神识单位抵抗控制
 * 4. 击杀场景 - 高伤害技能秒杀
 * 5. 流派对抗 - 法修 vs 体修 vs 敏修 vs 控修
 */

import { ActiveSkill } from '../../abilities/ActiveSkill';
import { BattleEngineV5 } from '../../BattleEngineV5';
import { EventBus } from '../../core/EventBus';
import { AttributeType } from '../../core/types';
import { Unit } from '../../units/Unit';

// ===== 测试技能定义 =====

/** 必杀技 - 高伤害法术 */
class UltimateSkill extends ActiveSkill {
  constructor() {
    super('ultimate' as any, '必杀技', 0, 0);
    this.setDamageCoefficient(5.0);
    this.setBaseDamage(200);
    this.setIsMagicAbility(true);
    this.setManaCost(0);
    this.setPriority(100);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

/** 控制技能 - 消耗 MP，可被抵抗 */
class ControlSkill extends ActiveSkill {
  constructor() {
    super('control_skill' as any, '禁锢术', 20, 2);
    this.setDamageCoefficient(0.5);
    this.setBaseDamage(10);
    this.setIsMagicAbility(true);
    this.setIsDebuffAbility(true);
    this.setManaCost(20);
    this.setPriority(50);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

/** 普通攻击 */
class NormalAttackSkill extends ActiveSkill {
  constructor() {
    super('normal_attack' as any, '攻击', 0, 0);
    this.setDamageCoefficient(1.0);
    this.setBaseDamage(30);
    this.setIsPhysicalAbility(true);
    this.setManaCost(0);
    this.setPriority(10);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

// ===== 测试场景 =====

describe('战斗机制可视化测试', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
  });

  afterEach(() => {
    eventBus.reset();
  });

  /**
   * 场景1: 基础战斗
   * 验证：伤害计算、回合流程、胜负判定
   */
  it('场景1: 基础战斗 - 均衡属性对决', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景1: 基础战斗 - 均衡属性对决                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const player = new Unit('player', '玩家', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 80,
      [AttributeType.AGILITY]: 60,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const opponent = new Unit('opponent', '对手', {
      [AttributeType.SPIRIT]: 90,
      [AttributeType.PHYSIQUE]: 90,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 50,
    });

    player.abilities.addAbility(new NormalAttackSkill());
    opponent.abilities.addAbility(new NormalAttackSkill());
    player.currentMp = 100;
    opponent.currentMp = 100;

    console.log('【角色属性】');
    console.log(`玩家 - 灵${player.attributes.getValue(AttributeType.SPIRIT)} 体${player.attributes.getValue(AttributeType.PHYSIQUE)} 身${player.attributes.getValue(AttributeType.AGILITY)} 神${player.attributes.getValue(AttributeType.CONSCIOUSNESS)} 悟${player.attributes.getValue(AttributeType.COMPREHENSION)}`);
    console.log(`对手 - 灵${opponent.attributes.getValue(AttributeType.SPIRIT)} 体${opponent.attributes.getValue(AttributeType.PHYSIQUE)} 身${opponent.attributes.getValue(AttributeType.AGILITY)} 神${opponent.attributes.getValue(AttributeType.CONSCIOUSNESS)} 悟${opponent.attributes.getValue(AttributeType.COMPREHENSION)}`);
    console.log();

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log(`战斗日志数: ${result.logs.length}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n');
  });

  /**
   * 场景2: 闪避机制
   * 验证：高身法单位触发闪避
   */
  it('场景2: 闪避机制 - 极致身法对决', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景2: 闪避机制 - 极致身法对决                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const lowAgility = new Unit('low_agi', '笨重战士', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 10, // 极低身法
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const highAgility = new Unit('high_agi', '飘逸刺客', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 200, // 极高身法
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 100,
    });

    lowAgility.abilities.addAbility(new NormalAttackSkill());
    highAgility.abilities.addAbility(new NormalAttackSkill());
    lowAgility.currentMp = 100;
    highAgility.currentMp = 100;

    console.log('【角色属性】');
    console.log(`笨重战士 - 身法${lowAgility.attributes.getValue(AttributeType.AGILITY)} (闪避率${(lowAgility.attributes.getEvasionRate() * 100).toFixed(1)}%)`);
    console.log(`飘逸刺客 - 身法${highAgility.attributes.getValue(AttributeType.AGILITY)} (闪避率${(highAgility.attributes.getEvasionRate() * 100).toFixed(1)}%)`);
    console.log();

    const engine = new BattleEngineV5(lowAgility, highAgility);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【预期】应该看到大量闪避日志');
    console.log('');
  });

  /**
   * 场景3: 控制抵抗
   * 验证：高神识单位抵抗控制技能
   */
  it('场景3: 控制抵抗 - 神识对抗', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景3: 控制抵抗 - 神识对抗                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const weakMind = new Unit('weak_mind', '低神识术士', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 10, // 极低神识
      [AttributeType.COMPREHENSION]: 50,
    });

    const strongMind = new Unit('strong_mind', '高神识尊者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 200, // 极高神识
      [AttributeType.COMPREHENSION]: 80,
    });

    weakMind.abilities.addAbility(new ControlSkill());
    strongMind.abilities.addAbility(new ControlSkill());
    weakMind.currentMp = 100;
    strongMind.currentMp = 100;

    console.log('【角色属性】');
    console.log(`低神识术士 - 神识${weakMind.attributes.getValue(AttributeType.CONSCIOUSNESS)}`);
    console.log(`高神识尊者 - 神识${strongMind.attributes.getValue(AttributeType.CONSCIOUSNESS)}`);
    console.log();

    const engine = new BattleEngineV5(weakMind, strongMind);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【预期】应该看到抵抗日志');
    console.log('');
  });

  /**
   * 场景4: 击杀场景
   * 验证：高伤害技能秒杀低血量单位
   */
  it('场景4: 击杀场景 - 必杀技秒杀', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景4: 击杀场景 - 必杀技秒杀                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const powerhouse = new Unit('powerhouse', '法术大师', {
      [AttributeType.SPIRIT]: 200,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const glassCannon = new Unit('glass_cannon', '脆皮目标', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.PHYSIQUE]: 10,
      [AttributeType.AGILITY]: 10,
      [AttributeType.CONSCIOUSNESS]: 10,
      [AttributeType.COMPREHENSION]: 10,
    });

    powerhouse.abilities.addAbility(new UltimateSkill());
    glassCannon.abilities.addAbility(new NormalAttackSkill());
    powerhouse.currentMp = 100;
    glassCannon.currentMp = 100;

    console.log('【角色属性】');
    console.log(`法术大师 - 灵${powerhouse.attributes.getValue(AttributeType.SPIRIT)} (HP ${powerhouse.maxHp})`);
    console.log(`脆皮目标 - 灵${glassCannon.attributes.getValue(AttributeType.SPIRIT)} (HP ${glassCannon.maxHp})`);
    console.log();

    const engine = new BattleEngineV5(powerhouse, glassCannon);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【预期】应该快速击杀，回合数很少');
    console.log('');
  });

  /**
   * 场景5: 流派对抗 - 法修 vs 体修
   */
  it('场景5: 流派对抗 - 法修 vs 体修', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景5: 流派对抗 - 法修 vs 体修                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const mage = new Unit('mage', '法修', {
      [AttributeType.SPIRIT]: 200, // 高灵力
      [AttributeType.PHYSIQUE]: 50, // 低体魄
      [AttributeType.AGILITY]: 60,
      [AttributeType.CONSCIOUSNESS]: 80,
      [AttributeType.COMPREHENSION]: 70,
    });

    const warrior = new Unit('warrior', '体修', {
      [AttributeType.SPIRIT]: 50, // 低灵力
      [AttributeType.PHYSIQUE]: 200, // 高体魄
      [AttributeType.AGILITY]: 70,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    mage.abilities.addAbility(new UltimateSkill());
    warrior.abilities.addAbility(new NormalAttackSkill());
    mage.currentMp = 100;
    warrior.currentMp = 100;

    console.log('【角色属性】');
    console.log(`法修 - 灵${mage.attributes.getValue(AttributeType.SPIRIT)} 体${mage.attributes.getValue(AttributeType.PHYSIQUE)} (HP ${mage.maxHp})`);
    console.log(`体修 - 灵${warrior.attributes.getValue(AttributeType.SPIRIT)} 体${warrior.attributes.getValue(AttributeType.PHYSIQUE)} (HP ${warrior.maxHp})`);
    console.log('【设计预期】法修的高灵力法术应该克制体修的低体魄减伤');
    console.log();

    const engine = new BattleEngineV5(mage, warrior);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('');
  });

  /**
   * 场景6: 流派对抗 - 敏修 vs 控修
   */
  it('场景6: 流派对抗 - 敏修 vs 控修', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景6: 流派对抗 - 敏修 vs 控修                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const assassin = new Unit('assassin', '敏修', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 200, // 极高身法
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 100,
    });

    const controller = new Unit('controller', '控修', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 60,
      [AttributeType.CONSCIOUSNESS]: 200, // 极高神识
      [AttributeType.COMPREHENSION]: 80,
    });

    assassin.abilities.addAbility(new NormalAttackSkill());
    controller.abilities.addAbility(new ControlSkill());
    assassin.currentMp = 100;
    controller.currentMp = 100;

    console.log('【角色属性】');
    console.log(`敏修 - 身法${assassin.attributes.getValue(AttributeType.AGILITY)} (闪避${(assassin.attributes.getEvasionRate() * 100).toFixed(1)}% 暴击${(assassin.attributes.getCritRate() * 100).toFixed(1)}%)`);
    console.log(`控修 - 神识${controller.attributes.getValue(AttributeType.CONSCIOUSNESS)}`);
    console.log('【设计预期】敏修身法高能闪避，但控修神识高可能抵抗控制');
    console.log();

    const engine = new BattleEngineV5(assassin, controller);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('');
  });

  /**
   * 场景7: 综合属性 - 完美五修
   */
  it('场景7: 综合属性 - 完美五修对决', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           场景7: 综合属性 - 完美五修对决                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const perfect1 = new Unit('perfect1', '完美修士1', {
      [AttributeType.SPIRIT]: 150,
      [AttributeType.PHYSIQUE]: 150,
      [AttributeType.AGILITY]: 150,
      [AttributeType.CONSCIOUSNESS]: 150,
      [AttributeType.COMPREHENSION]: 150,
    });

    const perfect2 = new Unit('perfect2', '完美修士2', {
      [AttributeType.SPIRIT]: 150,
      [AttributeType.PHYSIQUE]: 150,
      [AttributeType.AGILITY]: 150,
      [AttributeType.CONSCIOUSNESS]: 150,
      [AttributeType.COMPREHENSION]: 150,
    });

    perfect1.abilities.addAbility(new UltimateSkill());
    perfect2.abilities.addAbility(new UltimateSkill());
    perfect1.currentMp = 100;
    perfect2.currentMp = 100;

    console.log('【角色属性】');
    console.log(`完美修士1 - 全属性150 (HP ${perfect1.maxHp}, MP ${perfect1.maxMp})`);
    console.log(`完美修士2 - 全属性150 (HP ${perfect2.maxHp}, MP ${perfect2.maxMp})`);
    console.log();

    const engine = new BattleEngineV5(perfect1, perfect2);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【预期】均衡属性下战斗回合较多，胜负可能取决于随机因素');
    console.log('');
  });
});
