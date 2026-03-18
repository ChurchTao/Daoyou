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
});
