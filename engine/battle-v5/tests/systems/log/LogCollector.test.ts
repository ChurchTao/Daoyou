import { EventBus } from '../../../core';
import { LogCollector } from '../../../systems/log/LogCollector';
import { LogAggregator } from '../../../systems/log/LogAggregator';
import {
  BattleInitEvent,
  RoundStartEvent,
  SkillCastEvent,
  DamageTakenEvent,
  HealEvent,
  ShieldEvent,
  BuffAppliedEvent,
  BuffRemovedEvent,
  HitCheckEvent,
} from '../../../core/events';

describe('LogCollector', () => {
  let collector: LogCollector;
  let aggregator: LogAggregator;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    aggregator = new LogAggregator();
    collector = new LogCollector(aggregator);
  });

  afterEach(() => {
    collector.unsubscribe(eventBus);
    eventBus.reset();
  });

  describe('subscribe - Span management', () => {
    it('should create battle_init span on BattleInitEvent', () => {
      collector.subscribe(eventBus);

      eventBus.publish<BattleInitEvent>({
        type: 'BattleInitEvent',
        player: { id: 'p1', name: '张三' } as any,
        opponent: { id: 'o1', name: '李四' } as any,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('battle_init');
    });

    it('should create round_start span on RoundStartEvent', () => {
      collector.subscribe(eventBus);

      eventBus.publish<RoundStartEvent>({
        type: 'RoundStartEvent',
        turn: 1,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('round_start');
      expect(spans[0].turn).toBe(1);
    });

    it('should create action span on SkillCastEvent', () => {
      collector.subscribe(eventBus);

      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四' } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('action');
      expect(spans[0].actor).toEqual({ id: 'p1', name: '张三' });
      expect(spans[0].ability).toEqual({ id: 'skill-1', name: '火球术' });
    });
  });

  describe('subscribe - Entry collection', () => {
    it('should create damage entry on DamageTakenEvent', () => {
      collector.subscribe(eventBus);

      // 先创建 action span
      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四' } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        timestamp: Date.now(),
      });

      // 再发布伤害事件
      eventBus.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四', currentHp: 50, maxHp: 100 } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        damageTaken: 100,
        remainHealth: 50,
        isCritical: false,
        isLethal: false,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      const actionSpan = spans.find((s) => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(1);
      expect(actionSpan?.entries[0].type).toBe('damage');
      expect(actionSpan?.entries[0].data.value).toBe(100);
    });

    it('should create heal entry on HealEvent', () => {
      collector.subscribe(eventBus);

      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'p1', name: '张三' } as any,
        ability: { id: 'heal-1', name: '治疗术' } as any,
        timestamp: Date.now(),
      });

      eventBus.publish<HealEvent>({
        type: 'HealEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'p1', name: '张三', currentHp: 80 } as any,
        ability: { id: 'heal-1', name: '治疗术' } as any,
        healAmount: 50,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      const actionSpan = spans.find((s) => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(1);
      expect(actionSpan?.entries[0].type).toBe('heal');
    });

    it('should create shield entry on ShieldEvent', () => {
      collector.subscribe(eventBus);

      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'p1', name: '张三' } as any,
        ability: { id: 'shield-1', name: '护盾术' } as any,
        timestamp: Date.now(),
      });

      eventBus.publish<ShieldEvent>({
        type: 'ShieldEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'p1', name: '张三' } as any,
        ability: { id: 'shield-1', name: '护盾术' } as any,
        shieldAmount: 100,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      const actionSpan = spans.find((s) => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(1);
      expect(actionSpan?.entries[0].type).toBe('shield');
    });

    it('should create dodge entry on HitCheckEvent with isDodged', () => {
      collector.subscribe(eventBus);

      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四' } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        timestamp: Date.now(),
      });

      eventBus.publish<HitCheckEvent>({
        type: 'HitCheckEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四' } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        isHit: false,
        isDodged: true,
        isResisted: false,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      const actionSpan = spans.find((s) => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(1);
      expect(actionSpan?.entries[0].type).toBe('dodge');
    });

    it('should create death entry on lethal damage', () => {
      collector.subscribe(eventBus);

      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四' } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        timestamp: Date.now(),
      });

      eventBus.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        caster: { id: 'p1', name: '张三' } as any,
        target: { id: 'o1', name: '李四', currentHp: 0, maxHp: 100 } as any,
        ability: { id: 'skill-1', name: '火球术' } as any,
        damageTaken: 100,
        remainHealth: 0,
        isCritical: true,
        isLethal: true,
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      const actionSpan = spans.find((s) => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(2);
      expect(actionSpan?.entries[0].type).toBe('damage');
      expect(actionSpan?.entries[1].type).toBe('death');
    });
  });

  describe('unsubscribe', () => {
    it('should remove all event handlers', () => {
      collector.subscribe(eventBus);
      collector.unsubscribe(eventBus);

      eventBus.publish<RoundStartEvent>({
        type: 'RoundStartEvent',
        turn: 1,
        timestamp: Date.now(),
      });

      expect(aggregator.getSpans()).toHaveLength(0);
    });
  });
});
