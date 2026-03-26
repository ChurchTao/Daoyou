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

    it('应该能聚合复合行动 (施法 + 伤害 + Buff)', () => {
      const complexSpan: LogSpan = {
        id: 's2',
        type: 'action',
        turn: 1,
        source: { id: 'u1', name: '林轩' },
        title: '林轩 施展【火球术】',
        entries: [
          {
            id: 'e1',
            type: 'skill_cast',
            data: { skillName: '火球术' },
            message: '施法: 火球术',
            highlight: false
          },
          {
            id: 'e2',
            type: 'damage',
            data: { targetName: '魔狼', value: 100 },
            message: '造成 100 点伤害',
            highlight: false
          },
          {
            id: 'e3',
            type: 'buff_apply',
            data: { targetName: '魔狼', buffName: '灼烧' },
            message: 'Buff应用: 灼烧',
            highlight: false
          }
        ],
        timestamp: Date.now()
      };
      const output = formatter.formatSpan(complexSpan);
      expect(output).toBe('林轩 施展【火球术】\n  对 魔狼 造成 100 点伤害并施加「灼烧」');
    });

    it('应该能聚合 action_pre Span (持续伤害)', () => {
      const preSpan: LogSpan = {
        id: 's3',
        type: 'action_pre',
        turn: 1,
        source: { id: 'u2', name: '蛇精' },
        title: '蛇精 持续效果结算',
        entries: [
          {
            id: 'e4',
            type: 'damage',
            data: { sourceBuff: '中毒', value: 50 },
            message: '受到 50 点伤害',
            highlight: false
          }
        ],
        timestamp: Date.now()
      };
      const output = formatter.formatSpan(preSpan);
      expect(output).toBe('蛇精 持续效果结算\n  由于「中毒」发作，蛇精 受到 50 点伤害');
    });

    it('应该在无法聚合时按顺序输出条目', () => {
      const simpleSpan: LogSpan = {
        id: 's4',
        type: 'action',
        turn: 1,
        source: { id: 'u1', name: '林轩' },
        title: '林轩 简单行动',
        entries: [
          {
            id: 'e5',
            type: 'damage',
            data: { value: 10 },
            message: '造成 10 点伤害',
            highlight: false
          }
        ],
        timestamp: Date.now()
      };
      const output = formatter.formatSpan(simpleSpan);
      expect(output).toContain('林轩 简单行动');
      expect(output).toContain('  造成 10 点伤害');
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
