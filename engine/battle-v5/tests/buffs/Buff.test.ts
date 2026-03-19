import { Buff, StackRule } from '../../buffs/Buff';
import { BuffType, BuffId } from '../../core/types';
import { Unit } from '../../units/Unit';
import { AttributeType, ModifierType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '../../core/GameplayTags';

describe('Buff', () => {
  let unit: Unit;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  describe('基础功能', () => {
    it('应该正确初始化 Buff', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      expect(buff.id).toBe('test_buff');
      expect(buff.name).toBe('测试Buff');
      expect(buff.type).toBe(BuffType.BUFF);
      expect(buff.getDuration()).toBe(3);
    });

    it('应该支持永久 Buff', () => {
      const buff = new Buff('perm_buff', '永久Buff', BuffType.BUFF, -1);
      expect(buff.isPermanent()).toBe(true);
    });

    it('应该正确计算持续时间', () => {
      const buff = new Buff('temp_buff', '临时Buff', BuffType.BUFF, 3);
      expect(buff.isExpired()).toBe(false);

      buff.tickDuration();
      expect(buff.getDuration()).toBe(2);

      buff.tickDuration();
      buff.tickDuration();
      expect(buff.isExpired()).toBe(true);
    });
  });

  describe('生命周期钩子', () => {
    it('应用时应该调用 onApply', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let applied = false;
      buff.onApply = (u) => {
        applied = true;
        expect(u).toBe(unit);
      };
      buff.onApply(unit);
      expect(applied).toBe(true);
    });

    it('移除时应该调用 onRemove', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let removed = false;
      buff.onRemove = (u) => {
        removed = true;
        expect(u).toBe(unit);
      };
      buff.onRemove(unit);
      expect(removed).toBe(true);
    });

    it('刷新时应该重置持续时间', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      buff.tickDuration();
      buff.tickDuration();
      expect(buff.getDuration()).toBe(1);

      buff.refreshDuration();
      expect(buff.getDuration()).toBe(3);
    });
  });

  describe('回合钩子', () => {
    it('应该支持回合开始钩子', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let called = false;
      buff.onTurnStart = (u) => {
        called = true;
      };
      buff.onTurnStart(unit);
      expect(called).toBe(true);
    });

    it('应该支持回合结束钩子', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let called = false;
      buff.onTurnEnd = (u) => {
        called = true;
      };
      buff.onTurnEnd(unit);
      expect(called).toBe(true);
    });
  });

  describe('Buff 标签系统', () => {
    it('新建 Buff 应有空的标签容器', () => {
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

      expect(buff.tags).toBeDefined();
    });

    it('应支持设置自定义标签', () => {
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);
      buff.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      expect(buff.tags.hasTag(GameplayTags.BUFF.TYPE_BUFF)).toBe(true);
    });

    it('默认堆叠规则应为 REFRESH_DURATION', () => {
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

      expect(buff.stackRule).toBe(StackRule.REFRESH_DURATION);
    });

    it('应支持自定义堆叠规则', () => {
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3, StackRule.STACK_LAYER);

      expect(buff.stackRule).toBe(StackRule.STACK_LAYER);
    });

    it('Buff 克隆应保留标签和堆叠规则', () => {
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3, StackRule.OVERRIDE);
      buff.tags.addTags([GameplayTags.BUFF.DOT_POISON]);

      const cloned = buff.clone();

      expect(cloned.tags.hasTag(GameplayTags.BUFF.DOT_POISON)).toBe(true);
      expect(cloned.stackRule).toBe(StackRule.OVERRIDE);
    });
  });

  describe('堆叠规则', () => {
    it('OVERRIDE 应替换旧 BUFF', () => {
      const testUnit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试1', BuffType.BUFF, 3, StackRule.OVERRIDE);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff1);
      expect(testUnit.buffs.getAllBuffIds()).toContain('test');

      const buff2 = new Buff('test' as any, '测试2', BuffType.BUFF, 5, StackRule.OVERRIDE);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff2);
      expect(testUnit.buffs.getAllBuffIds()).toHaveLength(1); // Only one buff
      expect(testUnit.buffs.getAllBuffIds()).toContain('test');
    });

    it('OVERRIDE 应原子操作，不递归触发事件', () => {
      const testUnit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试1', BuffType.BUFF, 3, StackRule.OVERRIDE);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      let eventCount = 0;
      EventBus.instance.subscribe('BuffAddEvent', () => {
        eventCount++;
      });

      testUnit.buffs.addBuff(buff1);
      expect(eventCount).toBe(1); // First buff triggers event

      const buff2 = new Buff('test' as any, '测试2', BuffType.BUFF, 5, StackRule.OVERRIDE);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff2);

      // Should have 2 events total (one for each addBuff call)
      // The old buggy implementation would have 3 events (first add, then remove+add in override)
      expect(eventCount).toBe(2);
    });

    it('STACK_LAYER 应调用 addLayer 方法', () => {
      const testUnit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试1', BuffType.BUFF, 3, StackRule.STACK_LAYER);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      // Add a custom addLayer method to track calls
      let layerCount = 0;
      (buff1 as any).addLayer = (layers: number) => {
        layerCount += layers;
      };

      testUnit.buffs.addBuff(buff1);

      const buff2 = new Buff('test' as any, '测试2', BuffType.BUFF, 5, StackRule.STACK_LAYER);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff2);

      expect(layerCount).toBe(1);
      expect(testUnit.buffs.getAllBuffIds()).toHaveLength(1);
    });

    it('REFRESH_DURATION 应刷新持续时间', () => {
      const testUnit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试1', BuffType.BUFF, 3, StackRule.REFRESH_DURATION);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff1);

      // Tick down the duration
      buff1.tickDuration();
      expect(buff1.getDuration()).toBe(2);

      const buff2 = new Buff('test' as any, '测试2', BuffType.BUFF, 5, StackRule.REFRESH_DURATION);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff2);

      // Should refresh to new buff's duration (5)
      expect(buff1.getDuration()).toBe(5);
      expect(testUnit.buffs.getAllBuffIds()).toHaveLength(1);
    });

    it('IGNORE 应忽略新 BUFF', () => {
      const testUnit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试1', BuffType.BUFF, 3, StackRule.IGNORE);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff1);
      expect(buff1.getDuration()).toBe(3);

      const buff2 = new Buff('test' as any, '测试2', BuffType.BUFF, 5, StackRule.IGNORE);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      testUnit.buffs.addBuff(buff2);

      // Should keep original duration
      expect(buff1.getDuration()).toBe(3);
      expect(testUnit.buffs.getAllBuffIds()).toHaveLength(1);
    });
  });
});
