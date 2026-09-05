import {
  CHARACTER_MANUALS_V1,
  compileCharacterManualsV1,
  resolveCombatCapabilitiesV1,
} from "../manuals/index.ts"
import { COMBAT_V6_PHASE_5A_VERSIONS } from "../version.ts"
import { projectCultivatorWithEquipmentSpecialToCombatV6 } from "./project-cultivator-with-equipment-special.ts"
import type {
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  ProjectCultivatorToCombatV6Input,
} from "./types.ts"

function contentConflicts(
  existingSkills: string[],
  existingStatuses: string[],
): CombatV6ProjectionDiagnostic[] {
  const existing = new Set([...existingSkills, ...existingStatuses])
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const manualContentIds = CHARACTER_MANUALS_V1.flatMap((definition) => [
    definition.id,
    ...(definition.skill ? [definition.skill.id] : []),
  ])
  for (const id of manualContentIds) {
    if (existing.has(id)) diagnostics.push({ severity: "error", code: "CONTENT_ID_CONFLICT", message: `功法战斗内容 ID 冲突：${id}` })
  }
  return diagnostics
}

export function projectCultivatorToCombatV6(
  input: ProjectCultivatorToCombatV6Input,
): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_PHASE_5A_VERSIONS }
  const base = projectCultivatorWithEquipmentSpecialToCombatV6(input)
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }
  const manuals = compileCharacterManualsV1({ state: input.manuals, realm: input.cultivator.realm })
  if (!manuals.ok) return { ok: false, diagnostics: [...base.diagnostics, ...manuals.diagnostics], versions }
  const capabilities = resolveCombatCapabilitiesV1(manuals.projection.capabilities)
  if (!capabilities.ok) return { ok: false, diagnostics: [...base.diagnostics, ...manuals.projection.diagnostics, ...capabilities.diagnostics], versions }

  const diagnostics = [
    ...base.diagnostics,
    ...manuals.projection.diagnostics,
    ...capabilities.diagnostics,
    ...contentConflicts(
      base.skills.map((skill) => skill.id),
      base.statusDefs.map((status) => status.id),
    ),
  ]
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics, versions }

  const attrs = { ...base.unit.attrs }
  for (const contribution of manuals.projection.panel) {
    attrs[contribution.attr] = contribution.mode === "add"
      ? Math.floor((attrs[contribution.attr] ?? 0) + contribution.value)
      : Math.floor((attrs[contribution.attr] ?? 0) * contribution.value)
  }
  const manualPassiveIds = new Set(capabilities.passiveIds)
  const selectedSkills = manuals.projection.skills.filter((skill) => manualPassiveIds.has(skill.id))
  return {
    ok: true,
    unit: {
      ...base.unit,
      attrs,
      passives: [...(base.unit.passives ?? []), ...capabilities.passiveIds],
      skillLevels: { ...(base.unit.skillLevels ?? {}), ...manuals.projection.skillLevels },
      tags: [...new Set([...(base.unit.tags ?? []), ...manuals.projection.unitTags])],
    },
    skills: [...base.skills, ...selectedSkills],
    statusDefs: base.statusDefs,
    diagnostics,
    versions,
  }
}
