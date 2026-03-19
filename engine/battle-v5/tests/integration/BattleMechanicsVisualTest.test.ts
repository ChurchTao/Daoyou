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
import { Buff, StackRule } from '../../buffs/Buff';
import { PoisonDotBuff } from '../../buffs/examples/PoisonDotBuff';
import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '../../core/GameplayTags';
import {
  AttributeModifier,
  AttributeType,
  BuffType,
  ModifierType,
} from '../../core/types';
import { Unit } from '../../units/Unit';

// ===== 测试技能定义 =====

/** 必杀技 - 高伤害法术 */
class UltimateSkill extends ActiveSkill {
  constructor() {
    super('ultimate', '必杀技', 0, 0);
    this.setDamageCoefficient(5.0);
    this.setBaseDamage(200);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
    this.setManaCost(0);
    this.setPriority(100);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

/** 控制技能 - 消耗 MP，可被抵抗 */
class ControlSkill extends ActiveSkill {
  constructor() {
    super('control_skill', '禁锢术', 20, 2);
    this.setDamageCoefficient(0.5);
    this.setBaseDamage(10);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_CONTROL]);
    this.setManaCost(20);
    this.setPriority(50);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

/** 普通攻击 */
class NormalAttackSkill extends ActiveSkill {
  constructor() {
    super('normal_attack', '攻击', 0, 0);
    this.setDamageCoefficient(1.0);
    this.setBaseDamage(30);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_PHYSICAL]);
    this.setManaCost(0);
    this.setPriority(10);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {}
}

/** 毒术技能 - 添加DEBUFF（使用 GAS+EDA 模式的 PoisonDotBuff） */
class PoisonSkill extends ActiveSkill {
  constructor() {
    super('poison_skill', '腐蚀毒术', 15, 2);
    this.setDamageCoefficient(0.8);
    this.setBaseDamage(20);
    this.tags.addTags([
      GameplayTags.ABILITY.TYPE_MAGIC,
      GameplayTags.ABILITY.TYPE_DAMAGE,
    ]);
    this.setManaCost(15);
    this.setPriority(40);
  }

  protected executeSkill(_caster: Unit, target: Unit): void {
    // 使用新的 PoisonDotBuff（GAS+EDA 模式）
    // 订阅 RoundPreEvent，每回合造成体魄*5*层数的伤害
    // 降低身法 20%，持续 3 回合
    const poisonDotBuff = new PoisonDotBuff(1);
    target.buffs.addBuff(poisonDotBuff);
  }
}

class ShieldBuff extends Buff {
  constructor() {
    super('shield', '护盾', BuffType.BUFF, 4, StackRule.REFRESH_DURATION);
    this.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);
  }

  onActivate(): void {
    // 添加属性修改器
    const modifier: AttributeModifier = {
      id: 'shield_spirit_bonus',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.MULTIPLY,
      value: 1.2, // 120%灵力（增加20%）
      source: this,
    };
    this._owner?.attributes.addModifier(modifier);
  }

  onDeactivate(): void {
    // 移除属性修改器
    this._owner?.attributes.removeModifier('shield_spirit_bonus');
  }
}

/** 护盾技能 - 添加BUFF */
class ShieldBuffSkill extends ActiveSkill {
  constructor() {
    super('shield_buff', '护体真元', 25, 3);
    this.setDamageCoefficient(0.5);
    this.setBaseDamage(15);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
    this.setManaCost(25);
    this.setPriority(30);
  }

  protected executeSkill(_caster: Unit, target: Unit): void {
    const shieldBuff = new ShieldBuff();
    target.buffs.addBuff(shieldBuff);
  }
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景1: 基础战斗 - 均衡属性对决                    ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `玩家 - 灵${player.attributes.getValue(AttributeType.SPIRIT)} 体${player.attributes.getValue(AttributeType.PHYSIQUE)} 身${player.attributes.getValue(AttributeType.AGILITY)} 神${player.attributes.getValue(AttributeType.CONSCIOUSNESS)} 悟${player.attributes.getValue(AttributeType.COMPREHENSION)}`,
    );
    console.log(
      `对手 - 灵${opponent.attributes.getValue(AttributeType.SPIRIT)} 体${opponent.attributes.getValue(AttributeType.PHYSIQUE)} 身${opponent.attributes.getValue(AttributeType.AGILITY)} 神${opponent.attributes.getValue(AttributeType.CONSCIOUSNESS)} 悟${opponent.attributes.getValue(AttributeType.COMPREHENSION)}`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景2: 闪避机制 - 极致身法对决                    ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `笨重战士 - 身法${lowAgility.attributes.getValue(AttributeType.AGILITY)} (闪避率${(lowAgility.attributes.getEvasionRate() * 100).toFixed(1)}%)`,
    );
    console.log(
      `飘逸刺客 - 身法${highAgility.attributes.getValue(AttributeType.AGILITY)} (闪避率${(highAgility.attributes.getEvasionRate() * 100).toFixed(1)}%)`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景3: 控制抵抗 - 神识对抗                         ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `低神识术士 - 神识${weakMind.attributes.getValue(AttributeType.CONSCIOUSNESS)}`,
    );
    console.log(
      `高神识尊者 - 神识${strongMind.attributes.getValue(AttributeType.CONSCIOUSNESS)}`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景4: 击杀场景 - 必杀技秒杀                       ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `法术大师 - 灵${powerhouse.attributes.getValue(AttributeType.SPIRIT)} (HP ${powerhouse.maxHp})`,
    );
    console.log(
      `脆皮目标 - 灵${glassCannon.attributes.getValue(AttributeType.SPIRIT)} (HP ${glassCannon.maxHp})`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景5: 流派对抗 - 法修 vs 体修                     ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `法修 - 灵${mage.attributes.getValue(AttributeType.SPIRIT)} 体${mage.attributes.getValue(AttributeType.PHYSIQUE)} (HP ${mage.maxHp})`,
    );
    console.log(
      `体修 - 灵${warrior.attributes.getValue(AttributeType.SPIRIT)} 体${warrior.attributes.getValue(AttributeType.PHYSIQUE)} (HP ${warrior.maxHp})`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景6: 流派对抗 - 敏修 vs 控修                     ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `敏修 - 身法${assassin.attributes.getValue(AttributeType.AGILITY)} (闪避${(assassin.attributes.getEvasionRate() * 100).toFixed(1)}% 暴击${(assassin.attributes.getCritRate() * 100).toFixed(1)}%)`,
    );
    console.log(
      `控修 - 神识${controller.attributes.getValue(AttributeType.CONSCIOUSNESS)}`,
    );
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
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景7: 综合属性 - 完美五修对决                     ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

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
    console.log(
      `完美修士1 - 全属性150 (HP ${perfect1.maxHp}, MP ${perfect1.maxMp})`,
    );
    console.log(
      `完美修士2 - 全属性150 (HP ${perfect2.maxHp}, MP ${perfect2.maxMp})`,
    );
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

  /**
   * 场景8: BUFF/DEBUFF 机制演示
   * 验证：护盾BUFF提升伤害，毒术DEBUFF削弱对手
   */
  it('场景8: BUFF/DEBUFF 机制 - 辅助vs毒术对决', () => {
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景8: BUFF/DEBUFF 机制 - 辅助vs毒术对决         ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

    // 辅助修士：有护盾技能提升灵力
    const support = new Unit('support', '辅助修士', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 70,
    });

    // 毒术修士：有毒术技能削弱对手
    const poisoner = new Unit('poisoner', '毒术修士', {
      [AttributeType.SPIRIT]: 70,
      [AttributeType.PHYSIQUE]: 70,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 60,
    });

    support.abilities.addAbility(new ShieldBuffSkill());
    support.abilities.addAbility(new NormalAttackSkill());
    poisoner.abilities.addAbility(new PoisonSkill());
    poisoner.abilities.addAbility(new NormalAttackSkill());
    support.currentMp = 100;
    poisoner.currentMp = 100;

    console.log('【角色属性】');
    console.log(
      `辅助修士 - 灵${support.attributes.getValue(AttributeType.SPIRIT)} (拥有护体真元BUFF技能)`,
    );
    console.log(
      `毒术修士 - 灵${poisoner.attributes.getValue(AttributeType.SPIRIT)} (拥有腐蚀毒术DEBUFF技能)`,
    );
    console.log('【设计预期】');
    console.log('  - 辅助修士使用护体真元后，灵力提升20%，法术伤害增加');
    console.log('  - 毒术修士使用腐蚀毒术后，对手体魄降低10%，伤害减少');
    console.log('  - BUFF/DEBUFF持续期间，属性变化会显著影响战斗结果');
    console.log();

    const engine = new BattleEngineV5(support, poisoner);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【观察要点】');
    console.log('  - 查找"护体真元"BUFF应用日志');
    console.log('  - 查找"腐蚀毒术"DEBUFF应用日志');
    console.log('  - 观察BUFF/DEBUFF生效后的属性变化和伤害差异');
    console.log('');
  });

  /**
   * 场景9: 标签免疫机制
   * 验证：免疫标签可阻止DEBUFF
   */
  it('场景9: 标签免疫机制 - 免疫体 vs 毒术', () => {
    console.log(
      '\n╔══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║           场景9: 标签免疫机制 - 免疫体 vs 毒术               ║',
    );
    console.log(
      '╚══════════════════════════════════════════════════════════════╝\n',
    );

    // 免疫体：拥有免疫DEBUFF标签
    const immuneUnit = new Unit('immune', '免疫修士', {
      [AttributeType.SPIRIT]: 70,
      [AttributeType.PHYSIQUE]: 70,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 60,
    });
    immuneUnit.tags.addTags([GameplayTags.STATUS.IMMUNE_DEBUFF]);

    // 毒术修士
    const poisoner = new Unit('poisoner2', '毒术大师', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 60,
    });

    immuneUnit.abilities.addAbility(new NormalAttackSkill());
    poisoner.abilities.addAbility(new PoisonSkill());
    poisoner.abilities.addAbility(new NormalAttackSkill());
    immuneUnit.currentMp = 100;
    poisoner.currentMp = 100;

    console.log('【角色属性】');
    console.log(`免疫修士 - 拥有IMMUNE_DEBUFF标签（免疫所有DEBUFF）`);
    console.log(`毒术大师 - 擅长使用腐蚀毒术（3回合DEBUFF）`);
    console.log('【设计预期】');
    console.log('  - 毒术大师的腐蚀毒术会被免疫标签拦截');
    console.log('  - 免疫修士不会受到中毒DEBUFF的影响');
    console.log('  - 战报中应显示"免疫阻止了DEBUFF添加"');
    console.log();

    const engine = new BattleEngineV5(immuneUnit, poisoner);
    const result = engine.execute();

    console.log('\n【战斗结果】');
    console.log(`胜利者: ${result.winner}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('\n【完整战报】');
    result.logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));
    console.log('\n【观察要点】');
    console.log('  - 毒术大师释放毒术时，DEBUFF应被免疫标签拦截');
    console.log('  - 免疫修士的体魄应保持不变');
    console.log('  - 这展示了标签系统在技能交互中的强大能力');
    console.log('');
  });
});
