import { STORY_MARK_FACT_IDS, type StoryFactId } from './schema';

export type StorySignal =
  | { type: 'alchemy.craft.completed' }
  | { type: 'dungeon.run.settled'; outcome: string }
  | { type: 'wild.met'; nodeId: string };

type StorySignalRule = {
  type: StorySignal['type'];
  fact: (typeof STORY_MARK_FACT_IDS)[number];
  outcome?: string;
  nodeId?: string;
};

// 练功房不进入剧情。青溪坡上打完、捉住或自己退开记成事实，刚打开就放弃不算。
const rules: readonly StorySignalRule[] = [
  { type: 'alchemy.craft.completed', fact: 'alchemy_crafted' },
  {
    type: 'dungeon.run.settled',
    outcome: 'completed',
    fact: 'dungeon_settled',
  },
  {
    type: 'wild.met',
    nodeId: 'SAT_TN_08',
    fact: 'qingxi_met',
  },
];

export function storyMarkForSignal(signal: StorySignal): StoryFactId | null {
  const rule = rules.find((entry) => {
    if (entry.type !== signal.type) return false;
    if (entry.outcome && (!('outcome' in signal) || signal.outcome !== entry.outcome)) {
      return false;
    }
    if (entry.nodeId && (!('nodeId' in signal) || signal.nodeId !== entry.nodeId)) {
      return false;
    }
    return true;
  });
  return rule?.fact ?? null;
}
