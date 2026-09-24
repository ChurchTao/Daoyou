import { STORY_MARK_FACT_IDS, type StoryFactId } from './schema';

export type StorySignal =
  | { type: 'alchemy.craft.completed' }
  | { type: 'dungeon.run.settled'; outcome: string }
  | { type: 'wild.searched'; nodeId: string };

type StorySignalRule = {
  type: StorySignal['type'];
  fact: (typeof STORY_MARK_FACT_IDS)[number];
  outcome?: string;
  nodeId?: string;
};

// 练功房不进入剧情。青溪坡的一次寻觅记成事实，打赢与否不另算。
const rules: readonly StorySignalRule[] = [
  { type: 'alchemy.craft.completed', fact: 'alchemy_crafted' },
  {
    type: 'dungeon.run.settled',
    outcome: 'completed',
    fact: 'dungeon_settled',
  },
  {
    type: 'wild.searched',
    nodeId: 'SAT_TN_08',
    fact: 'qingxi_sought',
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
