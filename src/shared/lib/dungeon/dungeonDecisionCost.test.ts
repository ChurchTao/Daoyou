import { describe, expect, it } from 'vitest';
import { applyServerDungeonDecisionCost } from './dungeonDecisionCost';

describe('applyServerDungeonDecisionCost', () => {
  it.each([
    ['low', 300, '周全准备所需灵石'],
    ['medium', 200, '审慎推演所需灵石'],
    ['high', 100, '冒险破局所需灵石'],
  ] as const)(
    '为 %s 风险的选项附加服务器固定灵石代价',
    (riskLevel, value, desc) => {
      expect(applyServerDungeonDecisionCost([], riskLevel)).toEqual([
        { type: 'spirit_stones', value, desc },
      ]);
    },
  );

  it('移除 LLM 给出的灵石数值并替换为服务器固定值', () => {
    expect(
      applyServerDungeonDecisionCost(
        [{ type: 'spirit_stones', value: 9999, desc: '模型生成值' }],
        'high',
      ),
    ).toEqual([
      {
        type: 'spirit_stones',
        value: 100,
        desc: '冒险破局所需灵石',
      },
    ]);
  });

  it('保留 LLM 生成的非灵石行动代价', () => {
    const costs = [{ type: 'mp_loss' as const, value: 0.2, desc: '施法消耗' }];

    expect(applyServerDungeonDecisionCost(costs, 'medium')).toEqual([
      {
        type: 'spirit_stones',
        value: 200,
        desc: '审慎推演所需灵石',
      },
      costs[0],
    ]);
  });

  it('遭遇战选项同样附加服务器固定灵石代价', () => {
    const costs = [
      {
        type: 'battle' as const,
        value: 12,
        metadata: { race: '妖族' as const, realm_stage: '初期' as const },
      },
    ];

    expect(applyServerDungeonDecisionCost(costs, 'high')).toEqual([
      {
        type: 'spirit_stones',
        value: 100,
        desc: '冒险破局所需灵石',
      },
      costs[0],
    ]);
  });
});
