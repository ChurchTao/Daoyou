import type { LlmModelTier } from '@daoyou/contracts/llm/routing';
import type { LlmSceneId } from './types.js';

/**
 * 走高级模型组（LLM_ADVANCED_PROVIDER）的场景：一次输出需要统筹大量互相
 * 关联的设定，或需要逐条核对矛盾。其余场景都是单段创作或固定结构填写，
 * 使用基础模型组即可；未配置高级组时这些场景也回退到基础组。
 */
const ADVANCED_SCENES: ReadonlySet<LlmSceneId> = new Set<LlmSceneId>([
  // 解谜案卷大纲：一次定下全部人物、线索事实与真相，后续正文都以它为准。
  'dungeon-case',
  // 解谜案卷审校：对照设定找出分段撰写的正文之间的矛盾。
  'dungeon-case-review',
]);

export function llmTierForScene(sceneId: LlmSceneId): LlmModelTier {
  return ADVANCED_SCENES.has(sceneId) ? 'advanced' : 'basic';
}
