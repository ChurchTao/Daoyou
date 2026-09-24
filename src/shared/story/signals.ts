import { STORY_MARK_FACT_IDS, type StoryFactId } from './schema';

export type StorySignal =
  | { type: 'alchemy.craft.completed' }
  | { type: 'dungeon.run.settled'; outcome: string };

type StorySignalRule = {
  type: StorySignal['type'];
  fact: (typeof STORY_MARK_FACT_IDS)[number];
  outcome?: string;
};

// 练功房不进入剧情，也不做教学。往后出门认大地图和野外，等那条事实接上再登记。
const rules: readonly StorySignalRule[] = [
  { type: 'alchemy.craft.completed', fact: 'alchemy_crafted' },
  {
    type: 'dungeon.run.settled',
    outcome: 'completed',
    fact: 'dungeon_settled',
  },
];

export function storyMarkForSignal(signal: StorySignal): StoryFactId | null {
  const rule = rules.find((entry) => {
    if (entry.type !== signal.type) return false;
    if (entry.outcome && (!('outcome' in signal) || signal.outcome !== entry.outcome)) {
      return false;
    }
    return true;
  });
  return rule?.fact ?? null;
}
