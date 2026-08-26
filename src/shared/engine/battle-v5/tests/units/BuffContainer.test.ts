import { Buff, StackRule } from '../../buffs/Buff';
import { EventBus } from '../../core/EventBus';
import { DamageSegmentAppliedEvent } from '../../core/events';
import { BuffType } from '../../core/types';
import { BuffContainer } from '../../units/BuffContainer';
import { Unit } from '../../units/Unit';
import { CombatAttributionV3 } from '../../v3/origin';

// 创建一个测试用的 Buff 子类
class TestBuff extends Buff {
  activatedCount = 0;
  deactivatedCount = 0;

  constructor(
    id: string,
    name: string,
    stackRule: StackRule = StackRule.REFRESH_DURATION,
    stackPriority = 0,
  ) {
    super(
      id,
      name,
      BuffType.BUFF,
      5,
      stackRule,
      undefined,
      undefined,
      'player',
      'normal',
      true,
      undefined,
      stackPriority,
    );
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
    const cloned = new TestBuff(
      this.id,
      this.name,
      this.stackRule,
      this.stackPriority,
    );
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
    const buff1 = new TestBuff(
      'test_1',
      '测试 Buff 1',
      StackRule.REFRESH_DURATION,
    );
    const buff2 = new TestBuff(
      'test_1',
      '测试 Buff 1',
      StackRule.REFRESH_DURATION,
    );

    container.addBuff(buff1);
    // 模拟时间流逝
    buff1.tickDuration(); // 5 -> 4
    expect(buff1.getDuration()).toBe(4);

    container.addBuff(buff2);
    expect(container.getAllBuffs().length).toBe(1);
    expect(buff1.getDuration()).toBe(5); // 应该被刷新
    expect(buff1.activatedCount).toBe(1); // 不应该重新触发激活
  });

  test('REFRESH_DURATION 中更高优先级效果替换旧实例，较弱效果只刷新强效果', () => {
    const weak = new TestBuff(
      'test_priority',
      '弱效果',
      StackRule.REFRESH_DURATION,
      10,
    );
    const strong = new TestBuff(
      'test_priority',
      '强效果',
      StackRule.REFRESH_DURATION,
      30,
    );

    container.addBuff(weak);
    container.addBuff(strong);

    expect(container.getAllBuffs()).toEqual([strong]);
    expect(weak.deactivatedCount).toBe(1);
    expect(strong.activatedCount).toBe(1);

    strong.tickDuration();
    container.addBuff(weak);

    expect(container.getAllBuffs()).toEqual([strong]);
    expect(strong.getDuration()).toBe(5);
    expect(strong.deactivatedCount).toBe(0);
    expect(weak.activatedCount).toBe(1);
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

  test.each([
    StackRule.STACK_LAYER,
    StackRule.REFRESH_DURATION,
    StackRule.OVERRIDE,
  ])('%s 成功施加后原子替换完整归属', (stackRule) => {
    const firstSource = new Unit('first-source', '初次来源', {});
    const nextSource = new Unit('next-source', '本次来源', {});
    const firstAttribution = CombatAttributionV3.owned(firstSource, {
      kind: 'equipment',
      id: 'first-equipment',
      name: '旧法器',
    });
    const nextAttribution = CombatAttributionV3.owned(nextSource, {
      kind: 'gongfa',
      id: 'next-gongfa',
      name: '新功法',
    });

    container.addBuff(
      new TestBuff('attribution', '归属测试', stackRule),
      firstSource,
      { attribution: firstAttribution },
    );
    container.addBuff(
      new TestBuff('attribution', '归属测试', stackRule),
      nextSource,
      { attribution: nextAttribution },
    );

    const applied = container.getAllBuffs()[0];
    expect(applied.getSource()).toBe(nextSource);
    expect(applied.getCombatAttributionV3()).toBe(nextAttribution);
  });

  test('IGNORE 不改变已存在 Buff 的来源和归属', () => {
    const firstSource = new Unit('first-source', '初次来源', {});
    const ignoredSource = new Unit('ignored-source', '忽略来源', {});
    const firstAttribution = CombatAttributionV3.owned(firstSource, {
      kind: 'equipment',
      id: 'first-equipment',
      name: '旧法器',
    });
    const ignoredAttribution = CombatAttributionV3.owned(ignoredSource, {
      kind: 'gongfa',
      id: 'ignored-gongfa',
      name: '新功法',
    });

    container.addBuff(
      new TestBuff('ignored-attribution', '归属测试', StackRule.IGNORE),
      firstSource,
      { attribution: firstAttribution },
    );
    container.addBuff(
      new TestBuff('ignored-attribution', '归属测试', StackRule.IGNORE),
      ignoredSource,
      { attribution: ignoredAttribution },
    );

    const applied = container.getAllBuffs()[0];
    expect(applied.getSource()).toBe(firstSource);
    expect(applied.getCombatAttributionV3()).toBe(firstAttribution);
  });

  test('Buff.clone 只复制机制配置，不携带运行时归属', () => {
    const source = new Unit('source', '来源', {});
    const buff = new Buff('clone-attribution', '归属测试', BuffType.BUFF, 3);
    buff.setOwner(owner);
    buff.setSource(source);
    buff.setCombatAttributionV3(
      CombatAttributionV3.owned(source, {
        kind: 'buff',
        id: buff.id,
        name: buff.name,
      }),
    );

    const cloned = buff.clone();

    expect(cloned.getOwner()).toBeNull();
    expect(cloned.getSource()).toBeNull();
    expect(cloned.getCombatAttributionV3()).toBeUndefined();
  });

  test('事件订阅与触发：受击触发反伤', () => {
    let reflectDamage = 0;

    class ReflectBuff extends Buff {
      constructor() {
        super('reflect', '反伤 Buff', BuffType.BUFF, 5);
      }

      onActivate(): void {
        super.onActivate();
        this._subscribeEvent<DamageSegmentAppliedEvent>('DamageSegmentAppliedEvent', (e) => {
          if (e.target === this._owner) {
            reflectDamage += e.damageTaken * 0.2; // 反伤 20%
          }
        });
      }
    }

    const buff = new ReflectBuff();
    container.addBuff(buff);

    // 模拟受击事件
    EventBus.instance.publish<DamageSegmentAppliedEvent>({
      type: 'DamageSegmentAppliedEvent',
      timestamp: Date.now(),
      target: owner,
      damageTaken: 100,
      beforeHp: 1000,
      remainHp: 900,
      hpReachedZeroBeforeReactions: false,
    });

    expect(reflectDamage).toBe(20);

    // 移除 Buff 后不应再触发
    container.removeBuff('reflect');
    EventBus.instance.publish<DamageSegmentAppliedEvent>({
      type: 'DamageSegmentAppliedEvent',
      timestamp: Date.now(),
      target: owner,
      damageTaken: 100,
      beforeHp: 900,
      remainHp: 800,
      hpReachedZeroBeforeReactions: false,
    });

    expect(reflectDamage).toBe(20); // 依然是 20
  });
});
