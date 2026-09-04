import { CHARACTER_MANUALS_V1, compileCharacterManualsV1, resolveCombatCapabilitiesV1 } from "../manuals/index.ts"
import { COMBAT_V6_PHASE_6B_VERSIONS } from "../version.ts"
import { projectCultivatorWithEquipmentSpecialInternal } from "./project-cultivator-with-equipment-special.ts"
import type { CombatV6ProjectionDiagnostic, CombatV6ProjectionResult, ProjectCultivatorMultiSectToCombatV6Input } from "./types.ts"

function manualContentConflicts(existingSkills: string[], existingStatuses: string[]): CombatV6ProjectionDiagnostic[] {
  const existing = new Set([...existingSkills, ...existingStatuses])
  return CHARACTER_MANUALS_V1.flatMap((definition) => [definition.id, ...(definition.skill ? [definition.skill.id] : [])])
    .filter((id) => existing.has(id))
    .map((id) => ({ severity: "error" as const, code: "CONTENT_ID_CONFLICT" as const, message: `功法战斗内容 ID 冲突：${id}` }))
}

export function projectCultivatorMultiSectV3ToCombatV6(input: ProjectCultivatorMultiSectToCombatV6Input): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_PHASE_6B_VERSIONS }
  const base = projectCultivatorWithEquipmentSpecialInternal(input, versions, true, true)
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }
  const manuals = compileCharacterManualsV1({ state: input.manuals, realm: input.cultivator.realm })
  if (!manuals.ok) return { ok: false, diagnostics: [...base.diagnostics, ...manuals.diagnostics], versions }
  const capabilities = resolveCombatCapabilitiesV1(manuals.projection.capabilities)
  if (!capabilities.ok) return { ok: false, diagnostics: [...base.diagnostics, ...manuals.projection.diagnostics, ...capabilities.diagnostics], versions }
  const diagnostics = [
    ...base.diagnostics,
    ...manuals.projection.diagnostics,
    ...capabilities.diagnostics,
    ...manualContentConflicts(base.skills.map((skill) => skill.id), base.statusDefs.map((status) => status.id)),
  ]
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics, versions }
  const attrs = { ...base.unit.attrs }
  for (const contribution of manuals.projection.panel) {
    attrs[contribution.attr] = contribution.mode === "add"
      ? Math.floor((attrs[contribution.attr] ?? 0) + contribution.value)
      : Math.floor((attrs[contribution.attr] ?? 0) * contribution.value)
  }
  const passiveIds = new Set(capabilities.passiveIds)
  return {
    ok: true,
    unit: {
      ...base.unit,
      attrs,
      passives: [...(base.unit.passives ?? []), ...capabilities.passiveIds],
      skillLevels: { ...(base.unit.skillLevels ?? {}), ...manuals.projection.skillLevels },
      tags: [...new Set([...(base.unit.tags ?? []), ...manuals.projection.unitTags])],
    },
    skills: [...base.skills, ...manuals.projection.skills.filter((skill) => passiveIds.has(skill.id))],
    statusDefs: base.statusDefs,
    diagnostics,
    versions,
  }
}
