import { STORY_MARK_FACT_IDS, type StoryFactId } from './schema';

export type StorySignal =
  | { type: 'alchemy.craft.completed' }
  | { type: 'dungeon.run.settled'; outcome: string }
  | {
      type: 'combat.v6.battle.finished';
      sourceType: string;
      outcome: string;
    };

type StorySignalRule = {
  type: StorySignal['type'];
  fact: (typeof STORY_MARK_FACT_IDS)[number];
  outcome?: string;
  sourceType?: string;
};

// 世界里已经发生的事，在这里登记成剧情能认出的事实。
// 某一幕认不认，由章节里的 accept 决定，不在这里写死。
const rules: readonly StorySignalRule[] = [
  { type: 'alchemy.craft.completed', fact: 'alchemy_crafted' },
  {
    type: 'dungeon.run.settled',
    outcome: 'completed',
    fact: 'dungeon_settled',
  },
  {
    type: 'combat.v6.battle.finished',
    sourceType: 'training-room',
    outcome: 'victory',
    fact: 'training_victory',
  },
];

export function storyMarkForSignal(signal: StorySignal): StoryFactId | null {
  const rule = rules.find((entry) => {
    if (entry.type !== signal.type) return false;
    if (entry.outcome && (!('outcome' in signal) || signal.outcome !== entry.outcome)) {
      return false;
    }
    if (
      entry.sourceType &&
      (!('sourceType' in signal) || signal.sourceType !== entry.sourceType)
    ) {
      return false;
    }
    return true;
  });
  return rule?.fact ?? null;
}
