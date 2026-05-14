import { BuffContainer } from '../../units/BuffContainer';
import { Unit } from '../../units/Unit';
import { Buff, StackRule } from '../../buffs/Buff';
import { BuffType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { DamageTakenEvent } from '../../core/events';

// 创建一个测试用的 Buff 子类
class TestBuff extends Buff {
  activatedCount = 0;
  deactivatedCount = 0;

  constructor(id: string, name: string, stackRule: StackRule = StackRule.REFRESH_DURATION) {
    super(id, name, BuffType.BUFF, 5, stackRule);
  }

  onActivate(): void {
    super.onActivate();
    this.activatedCount++;
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.deactivatedCount++;
  }

  clone(): TestBuff {
    const cloned = new TestBuff(this.id, this.name, this.stackRule);
    cloned.activatedCount = this.activatedCount;
    cloned.deactivatedCount = this.deactivatedCount;
    return cloned;
  }
}

describe('BuffContainer', () => {
  let owner: Unit;
  let container: BuffContainer;

  beforeEach(() => {
    EventBus.instance.reset();
    owner = new Unit('owner', '所有者', {});
    container = owner.buffs;
  });

  test('添加新 Buff 应该触发激活', () => {
    const buff = new TestBuff('test_1', '测试 Buff 1');
    container.addBuff(buff);

    expect(container.getAllBuffIds()).toContain('test_1');
    expect(buff.activatedCount).toBe(1);
    expect(buff.getOwner()).toBe(owner);
  });

  test('移除 Buff 应该触发反激活', () => {
    const buff = new TestBuff('test_1', '测试 Buff 1');
    container.addBuff(buff);
    container.removeBuff('test_1');

    expect(container.getAllBuffIds()).not.toContain('test_1');
    expect(buff.deactivatedCount).toBe(1);
  });

  test('堆叠规则：REFRESH_DURATION', () => {
    const buff1 = new TestBuff('test_1', '测试 Buff 1', StackRule.REFRESH_DURATION);
    const buff2 = new TestBuff('test_1', '测试 Buff 1', StackRule.REFRESH_DURATION);
    
    container.addBuff(buff1);
    // 模拟时间流逝
    buff1.tickDuration(); // 5 -> 4
    expect(buff1.getDuration()).toBe(4);

    container.addBuff(buff2);
    expect(container.getAllBuffs().length).toBe(1);
    expect(buff1.getDuration()).toBe(5); // 应该被刷新
    expect(buff1.activatedCount).toBe(1); // 不应该重新触发激活
  });

  test('堆叠规则：STACK_LAYER', () => {
    const buff1 = new TestBuff('test_1', '测试 Buff 1', StackRule.STACK_LAYER);
    const buff2 = new TestBuff('test_1', '测试 Buff 1', StackRule.STACK_LAYER);
    
    container.addBuff(buff1);
    expect(buff1.getLayer()).toBe(1);

    container.addBuff(buff2);
    expect(buff1.getLayer()).toBe(2);
    expect(buff1.activatedCount).toBe(1);
  });

  test('堆叠规则：OVERRIDE', () => {
    const buff1 = new TestBuff('test_1', '测试 Buff 1', StackRule.OVERRIDE);
    const buff2 = new TestBuff('test_1', '测试 Buff 1', StackRule.OVERRIDE);
    
    container.addBuff(buff1);
    container.addBuff(buff2);

    expect(container.getAllBuffs()[0]).toBe(buff2);
    expect(buff1.deactivatedCount).toBe(1);
    expect(buff2.activatedCount).toBe(1);
    expect(buff2.getOwner()).toBe(owner);
  });

  test('事件订阅与触发：受击触发反伤', () => {
    let reflectDamage = 0;

    class ReflectBuff extends Buff {
      constructor() {
        super('reflect', '反伤 Buff', BuffType.BUFF, 5);
      }

      onActivate(): void {
        super.onActivate();
        this._subscribeEvent<DamageTakenEvent>('DamageTakenEvent', (e) => {
          if (e.target === this._owner) {
            reflectDamage += e.damageTaken * 0.2; // 反伤 20%
          }
        });
      }
    }

    const buff = new ReflectBuff();
    container.addBuff(buff);

    // 模拟受击事件
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      target: owner,
      damageTaken: 100,
      beforeHp: 1000,
      remainHp: 900,
      isLethal: false,
    });

    expect(reflectDamage).toBe(20);

    // 移除 Buff 后不应再触发
    container.removeBuff('reflect');
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      target: owner,
      damageTaken: 100,
      beforeHp: 900,
      remainHp: 800,
      isLethal: false,
    });

    expect(reflectDamage).toBe(20); // 依然是 20
  });
});
