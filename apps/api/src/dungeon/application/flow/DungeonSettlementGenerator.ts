import type { DungeonEndDisposition } from '@daoyou/game-domain/dungeon';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { z } from 'zod';
import { cleanMysteryText } from '../mystery/MysteryCaseReview.js';
import { mysteryEndingContext } from '../mystery/mysteryState.js';
import type { DungeonState } from './types.js';

/** LLM supplies ending prose/rating; flow owns deterministic rewards and commits. */
export async function generateDungeonEnding(
  state: DungeonState,
  endDisposition: DungeonEndDisposition,
) {
  const prompt = renderPrompt('dungeon-settlement', {
    userContextJson: stableCompactStringify(
      state.mystery
        ? { ...mysteryEndingContext(state.mystery), endDisposition }
        : {
            history: state.history,
            endDisposition,
            rewards: state.v6Rewards,
          },
    ),
  });
  const ending = await generateAiObject({
    system: prompt.system,
    prompt: prompt.user,
    schema: z.object({
      narrative: z.string().min(12).max(600),
      rating: z.enum(['S', 'A', 'B', 'C', 'D']),
    }),
    name: 'DungeonSettlement',
    sceneId: 'dungeon-settlement',
  });
  // 偶尔夹带的英文取值与字段名在这里去掉，叙事只留中文。
  return {
    ...ending.output,
    narrative: cleanMysteryText(ending.output.narrative, 600),
  };
}
