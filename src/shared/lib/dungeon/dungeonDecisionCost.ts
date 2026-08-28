import type { DungeonOptionCost } from './types';

export type DungeonDecisionRiskLevel = 'low' | 'medium' | 'high';

const DUNGEON_DECISION_SPIRIT_STONE_COSTS: Record<
  DungeonDecisionRiskLevel,
  number
> = {
  low: 300,
  medium: 200,
  high: 100,
};

const DUNGEON_DECISION_COST_DESCRIPTIONS: Record<
  DungeonDecisionRiskLevel,
  string
> = {
  low: '周全准备所需灵石',
  medium: '审慎推演所需灵石',
  high: '冒险破局所需灵石',
};

/**
 * 每个秘境抉择都由服务端附加固定灵石代价。稳健路线以准备资源
 * 换取安全，因此灵石代价高于莫测与凶险路线。LLM 生成的灵石
 * 数值不可信，统一移除；气血、法力、战斗等行动代价继续保留。
 */
export function applyServerDungeonDecisionCost(
  costs: DungeonOptionCost[],
  riskLevel: DungeonDecisionRiskLevel,
): DungeonOptionCost[] {
  const nonSpiritStoneCosts = costs.filter(
    (cost) => cost.type !== 'spirit_stones',
  );
  return [
    {
      type: 'spirit_stones',
      value: DUNGEON_DECISION_SPIRIT_STONE_COSTS[riskLevel],
      desc: DUNGEON_DECISION_COST_DESCRIPTIONS[riskLevel],
    },
    ...nonSpiritStoneCosts,
  ];
}
