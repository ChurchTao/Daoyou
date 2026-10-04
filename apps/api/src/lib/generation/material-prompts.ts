import {
  QUALITY_TO_RANK,
  TYPE_DESCRIPTIONS,
} from '@daoyou/game-content/materials';
import type { MaterialSkeleton } from '@daoyou/game-domain/materials/generation';
import { renderPromptSystem, renderPromptUser } from '@server/lib/prompts/index.js';

export function getMaterialGenerationPrompt(): string {
  return renderPromptSystem('material-generation');
}

export function getMaterialGenerationUserPrompt(
  skeletons: MaterialSkeleton[],
): string {
  const requestList = skeletons
    .map((s, i) => {
      const typeDesc = TYPE_DESCRIPTIONS[s.type];
      const rankNum = QUALITY_TO_RANK[s.rank];
      const elementReq = s.forcedElement
        ? `指定属性：${s.forcedElement}`
        : '属性：随机';
      return `${i + 1}. ${typeDesc} | 品质等级：${rankNum} | ${elementReq}`;
    })
    .join('\n');

  return renderPromptUser('material-generation', {
    requestList,
  });
}
