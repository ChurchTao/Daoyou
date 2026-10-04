import {
  COMBAT_V6_SECT_DEFINITIONS,
  validateCombatV6SectRegistry,
} from '@daoyou/game-content/sects';
import { compileSectDefinitionV6 } from './compiler.js';

import type {
  CompileSectCombatV6Result,
  SectCombatProgressV6,
  SectDefinitionV6,
} from '@daoyou/game-domain/combat';

type SectCompileInput = {
  progress: SectCombatProgressV6;
  characterLevel: number;
};

function compileRegisteredSect(
  input: SectCompileInput,
  registry: Partial<
    Record<
      import('@daoyou/game-domain/combat').CombatV6SectId,
      SectDefinitionV6
    >
  >,
  registryDiagnostics: import('@daoyou/game-domain/combat').CombatV6ProjectionDiagnostic[],
): CompileSectCombatV6Result {
  if (registryDiagnostics.some((item) => item.severity === 'error'))
    return { ok: false, diagnostics: registryDiagnostics };
  const definition = registry[input.progress.sectId];
  if (!definition)
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'UNKNOWN_SECT_CONTENT',
          message: `未知 combat-v6 宗门：${String(input.progress.sectId)}`,
          path: 'progress.sectId',
        },
      ],
    };
  return compileSectDefinitionV6({
    definition,
    progress: input.progress,
    characterLevel: input.characterLevel,
  });
}

/** 当前宗门编译入口。 */
export function compileCurrentSectCombatV6(
  input: SectCompileInput,
): CompileSectCombatV6Result {
  return compileRegisteredSect(
    input,
    COMBAT_V6_SECT_DEFINITIONS,
    validateCombatV6SectRegistry(),
  );
}

export {
  LINGXIAO_METHOD_ID,
  LINGXIAO_PATH_ID,
  LINGXIAO_RESOURCE_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
  LINGXIAO_V6_ID,
} from '@daoyou/game-content/sects/lingxiao';

export {
  YOUDU_METHOD_ID,
  YOUDU_PATH_ID,
  YOUDU_SKILL_ID,
  YOUDU_STATUS_ID,
  YOUDU_V6_DEFINITION,
  YOUDU_V6_ID,
} from '@daoyou/game-content/sects/youdu';

export {
  WUXIANG_METHOD_ID,
  WUXIANG_PATH_ID,
  WUXIANG_RESOURCE_ID,
  WUXIANG_SKILL_ID,
  WUXIANG_STATUS_ID,
  WUXIANG_V6_DEFINITION,
  WUXIANG_V6_ID,
} from '@daoyou/game-content/sects/wuxiang';

export {
  TIANYAN_MARK_KIND,
  TIANYAN_METHOD_ID,
  TIANYAN_PATH_ID,
  TIANYAN_REACTIONS_V1,
  TIANYAN_SKILL_ID,
  TIANYAN_V6_DEFINITION,
  TIANYAN_V6_ID,
} from '@daoyou/game-content/sects/tianyan';

export type {
  TianyanElementV1,
  TianyanReactionDefV1,
  TianyanReactionKindV1,
} from '@daoyou/game-content/sects/tianyan';

export {
  JIUJIE_METHOD_ID,
  JIUJIE_PATH_ID,
  JIUJIE_SKILL_ID,
  JIUJIE_STATUS_ID,
  JIUJIE_V6_DEFINITION,
  JIUJIE_V6_ID,
  validateJiujieContentV1,
} from '@daoyou/game-content/sects/jiujie';

export type { CombatV6PanelContribution } from '@daoyou/game-domain/combat';

export type {
  CombatV6SectId,
  CompileSectCombatV6Result,
  MeridianNodeDefV6,
  SectCombatProgressV6,
  SectCombatProjectionV6,
  SectDefinitionV6,
  SectMeridianLoadoutV6,
  SectMethodDefV6,
  SectPathDefV6,
  SectSkillDefV6,
  SkillPatchV6,
} from '@daoyou/game-domain/combat';
