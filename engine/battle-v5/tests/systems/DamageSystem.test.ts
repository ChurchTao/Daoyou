import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { AttributeType, DamageSource, DamageType } from '../../core/types';
import { DamageRequestEvent, DamageTakenEvent } from '../../core/events';
import { EventBus } from '../../core/EventBus';

describe('DamageSystem', () => {
  let damageSystem: DamageSystem;
  let attacker: Unit;
  let defender: Unit;

  beforeEach(() => {
    EventBus.instance.reset();
    damageSystem = new DamageSystem();

    attacker = new Unit('attacker', '攻击者', {
      [AttributeType.VITALITY]: 20,
    });

    defender = new Unit('defender', '防御者', {
      [AttributeType.VITALITY]: 10,
    });
    // 强制设置防御为 50 以匹配原始测试逻辑
    defender.attributes.addModifier({
      id: 'test_def_override',
      attrType: AttributeType.DEF,
      type: 'override' as any,
      value: 50,
    });
  });

  afterEach(() => {
    damageSystem.destroy();
  });

  test('基础物理伤害计算：ATK 100, DEF 50 -> 伤害应为 50 (不计随机波动)', () => {
    // 模拟固定随机因子
    const spyMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5); // 随机因子 1.0 (0.9 + 0.5 * 0.2)

    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      finalDamage: 100, // 假设基础伤害是 100
    };

    let capturedEvent: DamageTakenEvent | undefined;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      capturedEvent = e;
    });

    EventBus.instance.publish(request);

    // 计算逻辑：
    // 1. effectiveDef = 50 * (1 - 0) = 50
    // 2. reducedDamage = 100 - 50 = 50
    // 3. multiplier = 1 (默认)
    // 4. randomFactor = 0.9 + 0.5 * 0.2 = 1.0
    // 5. final = 50 * 1.0 = 50
    expect(capturedEvent?.damageTaken).toBe(50);

    spyMathRandom.mockRestore();
  });

  test('多层属性修正：增伤 20%，减伤 10% -> 净增伤 10%', () => {
    const spyMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5); // 1.0

    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      finalDamage: 100,
      damageIncreasePctBucket: 0.2, // 20% 增伤
      damageReductionPctBucket: 0.1, // 10% 减伤
    };

    let capturedEvent: DamageTakenEvent | undefined;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      capturedEvent = e;
    });

    EventBus.instance.publish(request);

    // 计算逻辑：
    // 1. 减防后伤害：100 - 50 = 50
    // 2. 乘法修正：1 + 0.2 - 0.1 = 1.1
    // 3. 50 * 1.1 = 55
    expect(capturedEvent?.damageTaken).toBe(55);

    spyMathRandom.mockRestore();
  });

  test('暴击判定：确认暴击乘数正确应用', () => {
    // 强制暴击
    const spyMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0); // 随机数 0 确保触发暴击
    
    attacker.attributes.addModifier({
      id: 'test_crit_rate',
      attrType: AttributeType.CRIT_RATE,
      type: 'override' as any,
      value: 1.0,
    });
    attacker.attributes.addModifier({
      id: 'test_crit_dmg',
      attrType: AttributeType.CRIT_DAMAGE_MULT,
      type: 'override' as any,
      value: 2.0,
    });

    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      finalDamage: 100,
    };

    let capturedEvent: DamageTakenEvent | undefined;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      capturedEvent = e;
    });

    EventBus.instance.publish(request);

    // 逻辑：
    // 1. 减防后：50
    // 2. 随机因子：0.9 + 0 * 0.2 = 0.9
    // 3. 暴击：50 * 2.0 = 100
    // 4. 100 * 0.9 = 90
    // 注意：DamageSystem.ts 中随机因子是在暴击判定之后应用的。
    // 代码顺序：... event.finalDamage *= damageMultiplier; (修正) -> 暴击判定 -> 随机浮动
    // 所以是 (50 * 1.0 * 2.0) * 0.9 = 90
    expect(capturedEvent?.isCritical).toBe(true);
    expect(capturedEvent?.damageTaken).toBe(90);

    spyMathRandom.mockRestore();
    jest.restoreAllMocks();
  });

  test('护盾吸收逻辑验证', () => {
    const spyMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5); // 1.0
    defender.addShield(30);

    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      finalDamage: 100,
    };

    let capturedEvent: DamageTakenEvent | undefined;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      capturedEvent = e;
    });

    EventBus.instance.publish(request);

    // 逻辑：
    // 1. 减防后伤害：50
    // 2. 护盾吸收：30
    // 3. 剩余伤害：20
    expect(capturedEvent?.shieldAbsorbed).toBe(30);
    expect(capturedEvent?.damageTaken).toBe(20);
    expect(defender.getCurrentShield()).toBe(0);

    spyMathRandom.mockRestore();
  });
});
