import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { AttributeType, DamageSource, DamageType, BuffType } from '../../core/types';
import { DamageRequestEvent, DamageTakenEvent, UnitDeadEvent } from '../../core/events';
import { EventBus } from '../../core/EventBus';
import { Buff } from '../../buffs/Buff';

describe('Combat Edge Cases (Integration)', () => {
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
  });

  afterEach(() => {
    damageSystem.destroy();
  });

  test('免死逻辑验证：HP 归零时触发免死，不应发布死亡事件', () => {
    // 设置防御为 0
    defender.attributes.addModifier({
      id: 'zero_def',
      attrType: AttributeType.DEF,
      type: 'override' as any,
      value: 0,
    });

    // 订阅受击事件，模拟“免死”效果：当 HP <= 0 时，强制设为 1
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      if (e.target === defender && e.remainHp <= 0) {
        defender.setHp(1); // 触发免死，锁血 1 点
      }
    });

    let deadEventCalled = false;
    EventBus.instance.subscribe<UnitDeadEvent>('UnitDeadEvent', () => {
      deadEventCalled = true;
    });

    // 发起致死伤害 (defender 基础 HP 为 200 + 10*16 = 360)
    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      finalDamage: 500, // 高于当前血量
      baseDamage: 500,
    };

    // 模拟无随机波动
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // factor 1.0

    EventBus.instance.publish(request);

    expect(defender.getCurrentHp()).toBe(1);
    expect(deadEventCalled).toBe(false); // 关键：不应触发死亡事件

    jest.restoreAllMocks();
  });

  test('属性更新一致性：Buff 移除后属性应立即恢复', () => {
    // 基础防御 VITALITY 10 -> DEF 40 (10*3+10*1)
    expect(defender.attributes.getValue(AttributeType.DEF)).toBe(40);

    class DefBuff extends Buff {
      constructor() {
        super('def_buff', '防御 Buff', BuffType.BUFF, 1);
      }
      onActivate() {
        this._owner?.attributes.addModifier({
          id: 'def_mod',
          attrType: AttributeType.DEF,
          type: 'fixed' as any,
          value: 20,
          source: this,
        });
      }
      onDeactivate() {
        this._owner?.attributes.removeModifier('def_mod');
      }
    }

    const buff = new DefBuff();
    defender.buffs.addBuff(buff);

    expect(defender.attributes.getValue(AttributeType.DEF)).toBe(60);

    // 移除 Buff
    defender.buffs.removeBuff('def_buff');

    // 关键检查：属性应回落
    expect(defender.attributes.getValue(AttributeType.DEF)).toBe(40);
  });
});
