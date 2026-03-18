import { CombatLogSystem } from '../../systems/CombatLogSystem';
import { CombatPhase } from '../../core/types';
import { Unit } from '../../units/Unit';
import { TestSkill } from '../__mocks__/TestSkill';
import { EventBus } from '../../core/EventBus';
import { SkillInterruptEvent, HitCheckEvent, DamageTakenEvent, UnitDeadEvent } from '../../core/events';

describe('CombatLogSystem', () => {
  let logSystem: CombatLogSystem;

  beforeEach(() => {
    logSystem = new CombatLogSystem();
  });

  it('应该正确记录战斗日志', () => {
    logSystem.log(1, CombatPhase.ACTION, '测试单位使用了火球术');

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('测试单位使用了火球术');
  });

  it('应该支持高光时刻标记', () => {
    logSystem.logHighlight(1, '测试单位觉醒了命格！');

    const logs = logSystem.getLogs();
    expect(logs[0].highlight).toBe(true);
  });

  it('应该支持极简模式过滤', () => {
    logSystem.log(1, CombatPhase.ROUND_PRE, '回合开始');
    logSystem.logHighlight(2, '高光时刻！');

    const simpleLogs = logSystem.getSimpleLogs();
    expect(simpleLogs.length).toBe(1);
    expect(simpleLogs[0].highlight).toBe(true);
  });

  it('应该清空日志', () => {
    logSystem.log(1, CombatPhase.ACTION, '测试日志');
    logSystem.clear();

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(0);
  });

  it('应该记录伤害日志', () => {
    logSystem.logDamage(1, '张三', '李四', 100, true);

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('张三');
    expect(logs[0].message).toContain('李四');
    expect(logs[0].message).toContain('100');
    expect(logs[0].message).toContain('暴击');
  });

  it('应该记录治疗日志', () => {
    logSystem.logHeal(1, '张三', '李四', 50);

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('张三');
    expect(logs[0].message).toContain('李四');
    expect(logs[0].message).toContain('50');
    expect(logs[0].message).toContain('恢复');
  });

  it('应该记录Buff应用日志', () => {
    logSystem.logBuff(1, '张三', '力量强化', true);

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('张三');
    expect(logs[0].message).toContain('力量强化');
    expect(logs[0].message).toContain('获得');
  });

  it('应该记录Buff移除日志', () => {
    logSystem.logBuff(1, '张三', '力量强化', false);

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('张三');
    expect(logs[0].message).toContain('力量强化');
    expect(logs[0].message).toContain('失去');
  });

  it('应该记录战斗结束日志', () => {
    logSystem.logBattleEnd('张三', 10);

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].highlight).toBe(true);
    expect(logs[0].message).toContain('张三');
    expect(logs[0].message).toContain('获胜');
    expect(logs[0].message).toContain('10');
  });

  it('应该获取指定回合的日志', () => {
    logSystem.log(1, CombatPhase.ACTION, '第一回合');
    logSystem.log(2, CombatPhase.ACTION, '第二回合');
    logSystem.log(1, CombatPhase.ROUND_PRE, '第一回合开始');

    const turn1Logs = logSystem.getLogsByTurn(1);
    expect(turn1Logs.length).toBe(2);

    const turn2Logs = logSystem.getLogsByTurn(2);
    expect(turn2Logs.length).toBe(1);
  });

  it('应该生成格式化战报', () => {
    logSystem.log(1, CombatPhase.ACTION, '测试单位使用了火球术');
    logSystem.logHighlight(1, '高光时刻！');

    const report = logSystem.generateReport();
    expect(report).toContain('[第1回合]');
    expect(report).toContain('[action]');
    expect(report).toContain('测试单位使用了火球术');
    expect(report).toContain('✨');
    expect(report).toContain('高光时刻！');
  });

  it('应该生成极简模式战报', () => {
    logSystem.log(1, CombatPhase.ROUND_PRE, '回合开始');
    logSystem.logHighlight(1, '高光时刻！');

    const report = logSystem.generateReport(true);
    expect(report).toContain('高光时刻！');
    expect(report).not.toContain('回合开始');
  });

  it('应该设置极简模式', () => {
    logSystem.setSimpleMode(true);
    // Simple mode is stored but doesn't affect log collection
    // It's used for UI rendering purposes
    expect(logSystem.getLogs().length).toBe(0);
  });

  it('应该为每条日志分配唯一ID', () => {
    logSystem.log(1, CombatPhase.ACTION, '日志1');
    logSystem.log(2, CombatPhase.ACTION, '日志2');

    const logs = logSystem.getLogs();
    expect(logs[0].id).toBe('log_0');
    expect(logs[1].id).toBe('log_1');
  });
});

describe('CombatLogSystem - NewEvents', () => {
  let logSystem: CombatLogSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    logSystem = new CombatLogSystem();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('应该记录技能打断事件', () => {
    const caster = new Unit('caster', '施法者', {});
    const ability = new TestSkill('test', '测试技能');

    eventBus.publish<SkillInterruptEvent>({
      type: 'SkillInterruptEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      ability,
      reason: '神识封禁',
    });

    const logs = logSystem.getLogs();
    const interruptLog = logs.find(log => log.message.includes('打断'));
    expect(interruptLog).toBeDefined();
    expect(interruptLog?.message).toContain('施法者');
    expect(interruptLog?.message).toContain('测试技能');
    expect(interruptLog?.highlight).toBe(true);
  });

  it('应该记录闪避事件', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const ability = new TestSkill('test', '测试技能');

    eventBus.publish<HitCheckEvent>({
      type: 'HitCheckEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: false,
      isDodged: true,
      isResisted: false,
    });

    const logs = logSystem.getLogs();
    const dodgeLog = logs.find(log => log.message.includes('闪避'));
    expect(dodgeLog).toBeDefined();
    expect(dodgeLog?.message).toContain('目标');
    expect(dodgeLog?.message).toContain('施法者');
    expect(dodgeLog?.message).toContain('测试技能');
    expect(dodgeLog?.highlight).toBe(false);
  });

  it('应该记录抵抗事件', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const ability = new TestSkill('test', '测试技能');

    eventBus.publish<HitCheckEvent>({
      type: 'HitCheckEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: false,
      isDodged: false,
      isResisted: true,
    });

    const logs = logSystem.getLogs();
    const resistLog = logs.find(log => log.message.includes('抵抗'));
    expect(resistLog).toBeDefined();
    expect(resistLog?.message).toContain('目标');
    expect(resistLog?.message).toContain('施法者');
    expect(resistLog?.message).toContain('测试技能');
    expect(resistLog?.highlight).toBe(false);
  });

  it('应该记录受击事件', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', { physique: 100 });
    target.takeDamage(30);

    eventBus.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 30,
      remainHealth: 70,
      isLethal: false,
    });

    const logs = logSystem.getLogs();
    const damageLog = logs.find(log => log.message.includes('造成'));
    expect(damageLog).toBeDefined();
    expect(damageLog?.message).toContain('施法者');
    expect(damageLog?.message).toContain('目标');
    expect(damageLog?.message).toContain('30');
    expect(damageLog?.message).toContain('70');
    expect(damageLog?.highlight).toBe(false);
  });

  it('应该记录致死伤害', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', { physique: 100 });
    target.takeDamage(100);

    eventBus.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 100,
      remainHealth: 0,
      isLethal: true,
    });

    const logs = logSystem.getLogs();
    const damageLog = logs.find(log => log.message.includes('造成'));
    const killLog = logs.find(log => log.message.includes('击杀'));

    expect(damageLog).toBeDefined();
    expect(killLog).toBeDefined();
    expect(killLog?.message).toContain('目标');
    expect(killLog?.message).toContain('气血耗尽');
    expect(killLog?.highlight).toBe(true);
  });

  it('应该记录单元死亡事件', () => {
    const killer = new Unit('killer', '击杀者', {});
    const victim = new Unit('victim', '受害者', {});

    eventBus.publish<UnitDeadEvent>({
      type: 'UnitDeadEvent',
      priority: 10,
      timestamp: Date.now(),
      unit: victim,
      killer,
    });

    const logs = logSystem.getLogs();
    const deadLog = logs.find(log => log.message.includes('阵亡'));
    expect(deadLog).toBeDefined();
    expect(deadLog?.message).toContain('受害者');
    expect(deadLog?.message).toContain('击杀者');
    expect(deadLog?.highlight).toBe(true);
  });

  it('不应该记录既没有闪避也没有抵抗的命中判定', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const ability = new TestSkill('test', '测试技能');

    eventBus.publish<HitCheckEvent>({
      type: 'HitCheckEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: true,
      isDodged: false,
      isResisted: false,
    });

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(0);
  });
});
