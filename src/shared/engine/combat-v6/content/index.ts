import { compileSectDefinitionV6 } from "./compiler.ts"
import { LINGXIAO_V6_DEFINITION } from "./lingxiao.ts"
import type { CompileSectCombatV6Result, SectCombatProgressV6 } from "./types.ts"

export function compileSectCombatV6(input: {
  progress: SectCombatProgressV6
  characterLevel: number
}): CompileSectCombatV6Result {
  return compileSectDefinitionV6({
    definition: LINGXIAO_V6_DEFINITION,
    progress: input.progress,
    characterLevel: input.characterLevel,
  })
}

export {
  LINGXIAO_METHOD_ID,
  LINGXIAO_PATH_ID,
  LINGXIAO_RESOURCE_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
  LINGXIAO_V6_ID,
} from "./lingxiao.ts"
export type { CombatV6PanelContribution } from "../projection/types.ts"
export type {
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
} from "./types.ts"
