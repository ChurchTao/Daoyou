import { TextFormatter, JsonFormatter } from '../../systems/log/LogFormatter';
import { LogSpan } from '../../systems/log/types';

describe('LogFormatter', () => {
  const mockSpan: LogSpan = {
    id: 's1',
    type: 'action',
    turn: 1,
    source: { id: 'u1', name: '林轩' },
    title: '林轩 施放【火球术】',
    entries: [
      {
        id: 'e1',
        type: 'damage',
        data: { value: 100 },
        message: '造成 100 点伤害',
        highlight: false
      }
    ],
    timestamp: Date.now()
  };

  describe('TextFormatter', () => {
    let formatter: TextFormatter;

    beforeEach(() => {
      formatter = new TextFormatter();
    });

    it('应该能格式化单个 Span', () => {
      const output = formatter.formatSpan(mockSpan);
      expect(output).toContain('林轩 施放【火球术】');
      expect(output).toContain('造成 100 点伤害');
    });

    it('应该能格式化完整结果', () => {
        const result = {
            battleId: 'b1',
            spans: [mockSpan],
            fullText: '',
            metadata: { winner: 'u1', loser: 'u2', turns: 1, duration: 100 }
        };
        const output = formatter.formatResult(result);
        expect(output).toContain('【第 1 回合】');
        expect(output).toContain('林轩 施放【火球术】');
    });
  });

  describe('JsonFormatter', () => {
    let formatter: JsonFormatter;

    beforeEach(() => {
      formatter = new JsonFormatter();
    });

    it('应该能格式化为 JSON', () => {
      const output = formatter.formatSpan(mockSpan);
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe('s1');
    });
  });
});
