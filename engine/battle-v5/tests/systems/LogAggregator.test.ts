import { LogAggregator } from '../../systems/log/LogAggregator';
import { LogSpan } from '../../systems/log/types';

describe('LogAggregator', () => {
  let aggregator: LogAggregator;

  beforeEach(() => {
    aggregator = new LogAggregator();
  });

  describe('Span 生命周期管理', () => {
    it('应该能开启 action_pre Span', () => {
      const unit = { id: 'u1', name: '测试单位' } as any;
      aggregator.beginActionPreSpan(unit);
      
      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('action_pre');
      expect(spans[0].source?.id).toBe('u1');
    });

    it('开启新 Span 时应该自动结束旧 Span', () => {
      const unit = { id: 'u1', name: '测试单位' } as any;
      const ability = { id: 'a1', name: '测试技能' } as any;
      
      aggregator.beginActionPreSpan(unit);
      aggregator.beginActionSpan(unit, ability);
      
      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(2);
      expect(spans[0].type).toBe('action_pre');
      expect(spans[1].type).toBe('action');
    });

    it('应该能添加 LogEntry 到当前活跃 Span', () => {
      const unit = { id: 'u1', name: '测试单位' } as any;
      aggregator.beginActionPreSpan(unit);
      
      aggregator.addEntry({
        id: 'e1',
        type: 'damage',
        data: { value: 10 },
        message: '造成 10 点伤害',
        highlight: false
      });
      
      const spans = aggregator.getSpans();
      expect(spans[0].entries).toHaveLength(1);
      expect(spans[0].entries[0].id).toBe('e1');
    });

    it('如果没有活跃 Span，添加 Entry 应该报错或忽略（根据实现定，建议忽略或创建默认）', () => {
        // 这里我们先验证不开启 Span 时添加 Entry 不会崩溃
        aggregator.addEntry({
          id: 'e1',
          type: 'damage',
          data: { value: 10 },
          message: '造成 10 点伤害',
          highlight: false
        });
        
        expect(aggregator.getSpans()).toHaveLength(0);
    });
  });

  describe('回合管理', () => {
      it('应该能按回合过滤 Span', () => {
          aggregator.beginRoundStartSpan(1);
          aggregator.beginActionPreSpan({ id: 'u1', name: 'u1' } as any);
          aggregator.beginRoundStartSpan(2);
          
          expect(aggregator.getSpansByTurn(1)).toHaveLength(2);
          expect(aggregator.getSpansByTurn(2)).toHaveLength(1);
      });
  });
});
