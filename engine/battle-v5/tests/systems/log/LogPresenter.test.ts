import { LogPresenter } from '../../../systems/log/LogPresenter';
import { LogSpan, LogEntry } from '../../../systems/log/types';

describe('LogPresenter', () => {
  let presenter: LogPresenter;

  beforeEach(() => {
    presenter = new LogPresenter();
  });

  describe('formatSpan', () => {
    it('should format round_start', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'round_start',
        turn: 1,
        entries: [],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【第 1 回合】');
    });

    it('should format battle_init', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'battle_init',
        turn: 0,
        entries: [],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【战斗开始】');
    });

    it('should format battle_end with winner', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'battle_end',
        turn: 5,
        actor: { id: 'winner', name: '张三' },
        entries: [],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【战斗结束】张三 获胜!');
    });

    it('should format action with damage', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'basic_attack', name: '普通攻击' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三发起攻击，对 李四 造成 100 点伤害');
    });

    it('should format action with critical damage', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 150, remainHp: 0, isCritical: true, targetName: '李四' },
            timestamp: Date.now(),
          },
          {
            id: 'e2',
            type: 'death',
            data: { targetName: '李四', killerName: '张三' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【火球术】，对 李四 造成 150 点伤害（暴击！），李四被击败!');
    });

    it('should format action with dodge', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'dodge',
            data: { targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【火球术】，被目标闪避了！');
    });

    it('should format action with resist', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'resist',
            data: { targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【火球术】，被目标抵抗了！');
    });

    it('should format action_pre with DOT', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action_pre',
        turn: 1,
        actor: { id: 'u1', name: '李四' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 50, remainHp: 50, isCritical: false, targetName: '李四', sourceBuff: '毒' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【持续】李四身上的「毒」发作，造成 50 点伤害');
    });

    it('should format action with heal', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'heal-1', name: '治疗术' },
        entries: [
          {
            id: 'e1',
            type: 'heal',
            data: { value: 50, remainHp: 80, targetName: '张三' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【治疗术】，为 张三 恢复 50 点气血');
    });

    it('should format action with shield', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'shield-1', name: '护盾术' },
        entries: [
          {
            id: 'e1',
            type: 'shield',
            data: { value: 100, targetName: '张三' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【护盾术】，为 张三 施加 100 点护盾');
    });

    it('should format action with damage + buff_apply', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '冰锥术' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 80, remainHp: 20, isCritical: false, targetName: '李四' },
            timestamp: Date.now(),
          },
          {
            id: 'e2',
            type: 'buff_apply',
            data: { buffName: '冰冻', buffType: 'debuff', targetName: '李四', duration: 2 },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【冰锥术】，对 李四 造成 80 点伤害并施加「冰冻」');
    });

    it('should format action with dispel', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'dispel-1', name: '净化术' },
        entries: [
          {
            id: 'e1',
            type: 'dispel',
            data: { buffs: ['毒', '灼烧'], targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【净化术】，清除了 李四 身上的 「毒」、「灼烧」');
    });
  });

  describe('getPlayerView', () => {
    it('should filter empty action spans', () => {
      const spans: LogSpan[] = [
        { id: 's1', type: 'battle_init', turn: 0, entries: [], timestamp: Date.now() },
        { id: 's2', type: 'round_start', turn: 1, entries: [], timestamp: Date.now() },
        { id: 's3', type: 'action_pre', turn: 1, entries: [], timestamp: Date.now() }, // 空 action_pre
        {
          id: 's4',
          type: 'action',
          turn: 1,
          actor: { id: 'u1', name: '张三' },
          ability: { id: 'basic_attack', name: '攻击' },
          entries: [{ id: 'e1', type: 'damage', data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' }, timestamp: Date.now() }],
          timestamp: Date.now(),
        },
      ];
      const result = presenter.getPlayerView(spans);
      expect(result).toHaveLength(3); // battle_init, round_start, action
      // 空 action_pre 不显示
      expect(result.find(l => l.includes('【持续】'))).toBeUndefined();
    });
  });

  describe('getAIView', () => {
    it('should return AI view with summary', () => {
      const spans: LogSpan[] = [
        { id: 's1', type: 'battle_init', turn: 0, entries: [], timestamp: Date.now() },
        { id: 's2', type: 'round_start', turn: 1, entries: [], timestamp: Date.now() },
      ];

      const aiView = presenter.getAIView(spans);
      expect(aiView.spans).toBeDefined();
      expect(aiView.summary).toBeDefined();
      expect(aiView.summary.totalDamage).toBe(0);
      expect(aiView.summary.turns).toBe(1);
    });
  });

  describe('getDebugView', () => {
    it('should return debug view with spans and event count', () => {
      const spans: LogSpan[] = [
        {
          id: 's1',
          type: 'action',
          turn: 1,
          actor: { id: 'u1', name: '张三' },
          entries: [
            { id: 'e1', type: 'damage', data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' }, timestamp: Date.now() },
            { id: 'e2', type: 'death', data: { targetName: '李四' }, timestamp: Date.now() },
          ],
          timestamp: Date.now(),
        },
      ];

      const debugView = presenter.getDebugView(spans) as { spans: LogSpan[]; eventCount: number };
      expect(debugView.spans).toHaveLength(1);
      expect(debugView.eventCount).toBe(2);
    });
  });
});
