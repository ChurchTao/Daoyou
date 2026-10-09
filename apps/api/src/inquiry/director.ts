import { CAVE_FALLBACK_DRAFT } from '@daoyou/game-content/inquiry';
import { getMapNode } from '@daoyou/game-content/world/map';
import { InquiryDirectorDraftSchema, type InquiryCaseFile } from '@daoyou/game-domain/inquiry';
import { compileInquiryCase } from '@daoyou/game-rules/inquiry';
import { resolveDungeonMapConfig } from '@daoyou/game-rules/world/dungeon';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { randomInt } from 'node:crypto';

const DIRECTOR_ATTEMPTS = 3;

/** Ask the director to fill the fixed slots. A failed draft never opens the cave. */
export async function authorInquiryCase(mapNodeId: string): Promise<InquiryCaseFile> {
  const map = getMapNode(mapNodeId);
  const setting =
    map && 'realm_requirement' in map
      ? {
          name: map.name,
          description: map.description,
          tags: map.tags,
          realm: map.realm_requirement,
          difficulty: resolveDungeonMapConfig(map).difficultyLabel,
          variation: randomInt(0, 0xffff).toString(16),
        }
      : { name: mapNodeId, variation: '0' };
  const prompt = renderPrompt('inquiry-director', {
    userContextJson: stableCompactStringify(setting),
  });
  for (let attempt = 1; attempt <= DIRECTOR_ATTEMPTS; attempt += 1) {
    try {
      const response = await generateAiObject({
        system: prompt.system,
        prompt: prompt.user,
        schema: InquiryDirectorDraftSchema,
        name: 'InquiryCase',
        sceneId: 'inquiry-director',
      });
      const compiled = compileInquiryCase(response.output);
      if (compiled.ok) return compiled.caseFile;
      console.warn(
        `[inquiry-director] 第 ${attempt} 次核对未过: ${compiled.reason}`,
      );
    } catch (error) {
      console.warn(
        `[inquiry-director] 第 ${attempt} 次生成失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }
  const fallback = compileInquiryCase(CAVE_FALLBACK_DRAFT);
  if (!fallback.ok) throw new Error(fallback.reason);
  console.warn('[inquiry-director] 改用备用案卷');
  return fallback.caseFile;
}
