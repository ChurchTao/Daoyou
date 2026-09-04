import { compileSectDefinitionV6 } from "./compiler.ts"
import { LINGXIAO_V6_DEFINITION } from "./lingxiao.ts"
import { YOUDU_V6_DEFINITION } from "./youdu.ts"
import { WUXIANG_V6_DEFINITION } from "./wuxiang.ts"
import { TIANYAN_V6_DEFINITION, validateTianyanReactionMatrixV1 } from "./tianyan.ts"
import { JIUJIE_V6_DEFINITION, validateJiujieContentV1 } from "./jiujie.ts"
import type { CombatV6SectIdV1, CombatV6SectIdV2, CombatV6SectIdV3, CompileSectCombatV6Result, SectCombatProgressV6, SectDefinitionV6 } from "./types.ts"

export const COMBAT_V6_SECT_DEFINITIONS_V1: Record<CombatV6SectIdV1, SectDefinitionV6> = Object.freeze({
  lingxiao: LINGXIAO_V6_DEFINITION,
  youdu: YOUDU_V6_DEFINITION,
})

export const COMBAT_V6_SECT_DEFINITIONS_V2: Record<CombatV6SectIdV2, SectDefinitionV6> = Object.freeze({
  ...COMBAT_V6_SECT_DEFINITIONS_V1,
  wuxiang: WUXIANG_V6_DEFINITION,
})

export const COMBAT_V6_SECT_DEFINITIONS_V3: Record<CombatV6SectIdV3, SectDefinitionV6> = Object.freeze({
  ...COMBAT_V6_SECT_DEFINITIONS_V2,
  tianyan: TIANYAN_V6_DEFINITION,
})

export const COMBAT_V6_SECT_DEFINITIONS_V4: Record<import("./types.ts").CombatV6SectId, SectDefinitionV6> = Object.freeze({
  ...COMBAT_V6_SECT_DEFINITIONS_V3,
  jiujie: JIUJIE_V6_DEFINITION,
})

function definitionIds(definition: SectDefinitionV6): string[] {
  const authored = [
    ...definition.skills,
    ...definition.paths.flatMap((path) => [
      ...(path.foundationPassives ?? []),
      ...(path.grantSkills ?? []),
      ...path.nodes.flatMap((node) => [...(node.passives ?? []), ...(node.grantSkills ?? [])]),
    ]),
  ]
  return [
    definition.id,
    ...definition.methods.map((method) => method.id),
    ...definition.statuses.map((status) => status.id),
    ...definition.paths.map((path) => path.id),
    ...definition.paths.flatMap((path) => (path.resources ?? []).map((resource) => resource.id)),
    ...definition.paths.flatMap((path) => path.nodes.map((node) => node.id)),
    ...authored.map((skill) => skill.definition.id),
    ...authored.flatMap((skill) => [...skill.definition.effects, ...(skill.definition.successEffects ?? [])])
      .filter((effect) => effect.type === "emitMechanic")
      .map((effect) => effect.type === "emitMechanic" ? effect.mechanicId : ""),
  ]
}

export function validateCombatV6SectRegistryV1(
  registry: Record<string, SectDefinitionV6> = COMBAT_V6_SECT_DEFINITIONS_V1,
): import("../projection/types.ts").CombatV6ProjectionDiagnostic[] {
  const diagnostics: import("../projection/types.ts").CombatV6ProjectionDiagnostic[] = []
  const owner = new Map<string, string>()
  for (const [key, definition] of Object.entries(registry)) {
    if (definition.id !== key) diagnostics.push({ severity: "error", code: "SECT_DEFINITION_MISMATCH", message: `注册键 ${key} 与宗门定义 ${definition.id} 不一致` })
    for (const id of definitionIds(definition)) {
      const previous = owner.get(id)
      if (previous && previous !== key) diagnostics.push({ severity: "error", code: "CROSS_SECT_CONTENT_ID_CONFLICT", message: `宗门 ${previous} 与 ${key} 的内容 ID 冲突：${id}` })
      else owner.set(id, key)
    }
  }
  return diagnostics
}

export function validateCombatV6SectRegistryV2(
  registry: Record<string, SectDefinitionV6> = COMBAT_V6_SECT_DEFINITIONS_V2,
): import("../projection/types.ts").CombatV6ProjectionDiagnostic[] {
  return validateCombatV6SectRegistryV1(registry)
}

export function validateCombatV6SectRegistryV3(
  registry: Record<string, SectDefinitionV6> = COMBAT_V6_SECT_DEFINITIONS_V3,
): import("../projection/types.ts").CombatV6ProjectionDiagnostic[] {
  return [...validateCombatV6SectRegistryV1(registry), ...validateTianyanReactionMatrixV1()]
}

export function validateCombatV6SectRegistryV4(
  registry: Record<string, SectDefinitionV6> = COMBAT_V6_SECT_DEFINITIONS_V4,
): import("../projection/types.ts").CombatV6ProjectionDiagnostic[] {
  return [...validateCombatV6SectRegistryV1(registry), ...validateTianyanReactionMatrixV1(), ...validateJiujieContentV1()]
}

export function compileSectCombatV6(input: {
  progress: SectCombatProgressV6
  characterLevel: number
}): CompileSectCombatV6Result {
  const registryDiagnostics = validateCombatV6SectRegistryV1()
  if (registryDiagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics: registryDiagnostics }
  const definition = input.progress.sectId in COMBAT_V6_SECT_DEFINITIONS_V1
    ? COMBAT_V6_SECT_DEFINITIONS_V1[input.progress.sectId as CombatV6SectIdV1]
    : undefined
  if (!definition) return { ok: false, diagnostics: [{ severity: "error", code: "UNKNOWN_SECT_CONTENT", message: `未知 combat-v6 宗门：${String(input.progress.sectId)}`, path: "progress.sectId" }] }
  return compileSectDefinitionV6({
    definition,
    progress: input.progress,
    characterLevel: input.characterLevel,
  })
}

export function compileSectCombatV6V2(input: {
  progress: SectCombatProgressV6
  characterLevel: number
}): CompileSectCombatV6Result {
  const registryDiagnostics = validateCombatV6SectRegistryV2()
  if (registryDiagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics: registryDiagnostics }
  const definition = input.progress.sectId in COMBAT_V6_SECT_DEFINITIONS_V2
    ? COMBAT_V6_SECT_DEFINITIONS_V2[input.progress.sectId as CombatV6SectIdV2]
    : undefined
  if (!definition) return { ok: false, diagnostics: [{ severity: "error", code: "UNKNOWN_SECT_CONTENT", message: `未知 combat-v6 宗门：${String(input.progress.sectId)}`, path: "progress.sectId" }] }
  return compileSectDefinitionV6({ definition, progress: input.progress, characterLevel: input.characterLevel })
}


export function compileSectCombatV6V3(input: {
  progress: SectCombatProgressV6
  characterLevel: number
}): CompileSectCombatV6Result {
  const registryDiagnostics = validateCombatV6SectRegistryV3()
  if (registryDiagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics: registryDiagnostics }
  const definition = input.progress.sectId in COMBAT_V6_SECT_DEFINITIONS_V3
    ? COMBAT_V6_SECT_DEFINITIONS_V3[input.progress.sectId as CombatV6SectIdV3]
    : undefined
  if (!definition) return { ok: false, diagnostics: [{ severity: "error", code: "UNKNOWN_SECT_CONTENT", message: `未知 combat-v6 宗门：${String(input.progress.sectId)}`, path: "progress.sectId" }] }
  return compileSectDefinitionV6({ definition, progress: input.progress, characterLevel: input.characterLevel })
}

export function compileSectCombatV6V4(input: {
  progress: SectCombatProgressV6
  characterLevel: number
}): CompileSectCombatV6Result {
  const registryDiagnostics = validateCombatV6SectRegistryV4()
  if (registryDiagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics: registryDiagnostics }
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[input.progress.sectId]
  if (!definition) return { ok: false, diagnostics: [{ severity: "error", code: "UNKNOWN_SECT_CONTENT", message: `未知 combat-v6 宗门：${String(input.progress.sectId)}`, path: "progress.sectId" }] }
  return compileSectDefinitionV6({ definition, progress: input.progress, characterLevel: input.characterLevel })
}

export {
  LINGXIAO_METHOD_ID,
  LINGXIAO_PATH_ID,
  LINGXIAO_RESOURCE_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
  LINGXIAO_V6_ID,
} from "./lingxiao.ts"
export {
  YOUDU_METHOD_ID,
  YOUDU_PATH_ID,
  YOUDU_SKILL_ID,
  YOUDU_STATUS_ID,
  YOUDU_V6_DEFINITION,
  YOUDU_V6_ID,
} from "./youdu.ts"
export {
  WUXIANG_BARRIER_ID,
  WUXIANG_METHOD_ID,
  WUXIANG_PATH_ID,
  WUXIANG_RESOURCE_ID,
  WUXIANG_SKILL_ID,
  WUXIANG_STATUS_ID,
  WUXIANG_V6_DEFINITION,
  WUXIANG_V6_ID,
} from "./wuxiang.ts"
export {
  TIANYAN_BARRIER_ID,
  TIANYAN_MARK_KIND,
  TIANYAN_METHOD_ID,
  TIANYAN_PATH_ID,
  TIANYAN_REACTIONS_V1,
  TIANYAN_RESOURCE_ID,
  TIANYAN_SKILL_ID,
  TIANYAN_STATUS_ID,
  TIANYAN_V6_DEFINITION,
  TIANYAN_V6_ID,
  validateTianyanReactionMatrixV1,
} from "./tianyan.ts"
export type { TianyanElementV1, TianyanReactionDefV1, TianyanReactionKindV1 } from "./tianyan.ts"
export {
  JIUJIE_MECHANIC_ID,
  JIUJIE_METHOD_ID,
  JIUJIE_PATH_ID,
  JIUJIE_SKILL_ID,
  JIUJIE_STATUS_ID,
  JIUJIE_V6_DEFINITION,
  JIUJIE_V6_ID,
  validateJiujieContentV1,
} from "./jiujie.ts"
export type { CombatV6PanelContribution } from "../projection/types.ts"
export type {
  CompileSectCombatV6Result,
  CombatV6SectId,
  CombatV6SectIdV1,
  CombatV6SectIdV2,
  CombatV6SectIdV3,
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
