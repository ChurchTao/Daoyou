import { LogAggregator } from '../../systems/log/LogAggregator';
import { LogEntry } from '../../systems/log/types';

describe('LogAggregator Refactored', () => {
  let aggregator: LogAggregator;

  beforeEach(() => {
    aggregator = new LogAggregator();
  });

  describe('currentTurn', () => {
    it('should return current turn', () => {
      aggregator.beginSpan('battle_init', { turn: 0 });
      expect(aggregator.currentTurn).toBe(0);

      aggregator.beginSpan('round_start', { turn: 1 });
      expect(aggregator.currentTurn).toBe(1);
    });
  });

  describe('beginSpan with actor/ability', () => {
    it('should create span with actor and ability', () => {
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'unit-1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].actor).toEqual({ id: 'unit-1', name: '张三' });
      expect(spans[0].ability).toEqual({ id: 'skill-1', name: '火球术' });
    });

    it('should create span with actor only (no ability)', () => {
      aggregator.beginSpan('action_pre', {
        turn: 1,
        actor: { id: 'unit-1', name: '李四' },
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].actor).toEqual({ id: 'unit-1', name: '李四' });
      expect(spans[0].ability).toBeUndefined();
    });
  });

  describe('addEntry', () => {
    it('should add entry to active span', () => {
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'u1', name: '张三' },
      });

      const entry: LogEntry<'damage'> = {
        id: 'entry-1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 50,
          isCritical: false,
          targetName: '李四',
          beforeHp: 0
        },
        timestamp: Date.now(),
      };
      aggregator.addEntry(entry);

      const spans = aggregator.getSpans();
      expect(spans[0].entries).toHaveLength(1);
      expect(spans[0].entries[0].type).toBe('damage');
    });

    it('should ignore entry when no active span', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      aggregator.addEntry({
        id: 'entry-1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 50,
          isCritical: false,
          targetName: '李四',
        },
        timestamp: Date.now(),
      });

      expect(aggregator.getSpans()).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('span lifecycle', () => {
    it('should auto-end previous span when starting new one', () => {
      aggregator.beginSpan('action_pre', {
        turn: 1,
        actor: { id: 'u1', name: '张三' },
      });
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(2);
      expect(spans[0].type).toBe('action_pre');
      expect(spans[1].type).toBe('action');
    });
  });

  describe('getSpansByTurn', () => {
    it('should filter spans by turn', () => {
      aggregator.beginSpan('round_start', { turn: 1 });
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'u1', name: '张三' },
      });
      aggregator.beginSpan('round_start', { turn: 2 });

      expect(aggregator.getSpansByTurn(1)).toHaveLength(2);
      expect(aggregator.getSpansByTurn(2)).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all spans and reset state', () => {
      aggregator.beginSpan('round_start', { turn: 1 });
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'u1', name: '张三' },
      });

      aggregator.clear();

      expect(aggregator.getSpans()).toHaveLength(0);
      expect(aggregator.currentTurn).toBe(0);
    });
  });
});
