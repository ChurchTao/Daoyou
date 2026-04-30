import { LogPresenter } from '../../systems/log/LogPresenter';
import { LogSpan } from '../../systems/log/types';

describe('LogPresenter', () => {
  let presenter: LogPresenter;

  beforeEach(() => {
    presenter = new LogPresenter();
  });

  describe('formatSpan - 伤害聚合', () => {
    it('应该能格式化复合行动 (施法 + 伤害 + Buff)', () => {
      const complexSpan: LogSpan = {
        id: 's2',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '林轩' },
        ability: { id: 'fireball', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: {
              value: 100,
              remainHp: 0,
              isCritical: false,
              targetName: '魔狼',
            },
            timestamp: Date.now(),
          },
          {
            id: 'e2',
            type: 'buff_apply',
            data: {
              buffName: '灼烧',
              buffType: 'debuff',
              targetName: '魔狼',
              duration: 3,
            },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      const output = presenter.formatSpan(complexSpan);
      const text = output.join(' ');
      // 新格式：单行聚合
      expect(text).toContain('林轩');
      expect(text).toContain('火球术');
      expect(text).toContain('100');
      expect(text).toContain('灼烧');
    });

    it('应该能格式化 action_pre Span (持续伤害)', () => {
      const preSpan: LogSpan = {
        id: 's3',
        type: 'action_pre',
        turn: 1,
        actor: { id: 'u2', name: '蛇精' },
        entries: [
          {
            id: 'e4',
            type: 'damage',
            data: {
              value: 50,
              remainHp: 50,
              isCritical: false,
              targetName: '蛇精',
              sourceBuff: '中毒',
            },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      const output = presenter.formatSpan(preSpan);
      const text = output.join(' ');
      // 新格式：蛇精身上的「中毒」发作，造成 50 点伤害
      expect(text).toContain('');
      expect(text).toContain('蛇精');
      expect(text).toContain('中毒');
      expect(text).toContain('50');
    });

    it('应该在无法聚合时输出基本信息', () => {
      const simpleSpan: LogSpan = {
        id: 's4',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '林轩' },
        ability: { id: 'basic_attack', name: '普攻' },
        entries: [
          {
            id: 'e5',
            type: 'damage',
            data: {
              value: 10,
              remainHp: 90,
              isCritical: false,
              targetName: '敌人',
            },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      const output = presenter.formatSpan(simpleSpan);
      const text = output.join(' ');
      expect(text).toContain('林轩');
      expect(text).toContain('10');
    });

    it('应该格式化闪避事件', () => {
      const dodgeSpan: LogSpan = {
        id: 's5',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '林轩' },
        ability: { id: 'fireball', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'dodge',
            data: { targetName: '敌人' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      const output = presenter.formatSpan(dodgeSpan);
      expect(output.join(' ')).toContain('闪避');
    });

    it('应该格式化暴击伤害', () => {
      const critSpan: LogSpan = {
        id: 's6',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '林轩' },
        ability: { id: 'fireball', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: {
              value: 200,
              remainHp: 0,
              isCritical: true,
              targetName: '敌人',
            },
            timestamp: Date.now(),
          },
          {
            id: 'e2',
            type: 'death',
            data: { targetName: '敌人', killerName: '林轩' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      const output = presenter.formatSpan(critSpan);
      const text = output.join(' ');
      expect(text).toContain('暴击');
      expect(text).toContain('击败');
    });
  });

  describe('getPlayerView', () => {
    it('应该过滤空 Span', () => {
      const spans: LogSpan[] = [
        {
          id: 's1',
          type: 'battle_init',
          turn: 0,
          entries: [],
          timestamp: Date.now(),
        },
        {
          id: 's2',
          type: 'action_pre',
          turn: 1,
          actor: { id: 'u1', name: '测试' },
          entries: [], // 空 entries
          timestamp: Date.now(),
        },
        {
          id: 's3',
          type: 'action',
          turn: 1,
          actor: { id: 'u1', name: '林轩' },
          entries: [
            {
              id: 'e1',
              type: 'damage',
              data: { value: 10, remainHp: 90, isCritical: false, targetName: '敌人' },
              timestamp: Date.now(),
            },
          ],
          timestamp: Date.now(),
        },
      ];
      const view = presenter.getPlayerView(spans);
      // battle_init 是结构性 Span，应该保留
      // action_pre 空 Span 应该被过滤
      // action 有内容，应该保留
      expect(view.length).toBe(2);
    });
  });

  describe('getAIView', () => {
    it('应该返回结构化数据和描述', () => {
      const spans: LogSpan[] = [
        {
          id: 's1',
          type: 'action',
          turn: 1,
          actor: { id: 'u1', name: '林轩' },
          ability: { id: 'fireball', name: '火球术' },
          entries: [
            {
              id: 'e1',
              type: 'damage',
              data: { value: 100, remainHp: 0, isCritical: false, targetName: '敌人' },
              timestamp: Date.now(),
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const aiView = presenter.getAIView(spans);
      expect(aiView.spans).toHaveLength(1);
      expect(aiView.spans[0].description).toBeDefined();
      expect(aiView.summary.totalDamage).toBe(100);
    });
  });

  describe('getDebugView', () => {
    it('应该返回调试数据', () => {
      const spans: LogSpan[] = [
        {
          id: 's1',
          type: 'action',
          turn: 1,
          actor: { id: 'u1', name: '林轩' },
          entries: [
            {
              id: 'e1',
              type: 'damage',
              data: { value: 100, remainHp: 0, isCritical: false, targetName: '敌人' },
              timestamp: Date.now(),
            },
            {
              id: 'e2',
              type: 'death',
              data: { targetName: '敌人' },
              timestamp: Date.now(),
            },
          ],
          timestamp: Date.now(),
        },
      ];

      const debugView = presenter.getDebugView(spans) as {
        spans: LogSpan[];
        eventCount: number;
      };
      expect(debugView.spans).toHaveLength(1);
      expect(debugView.eventCount).toBe(2);
    });
  });
});
