import { compileSectCombatV6 } from "../content/index.ts"
import type { CombatV6PanelContribution } from "../content/types.ts"
import type { LineupUnit } from "../core/index.ts"
import { COMBAT_V6_PHASE_3_VERSIONS } from "../version.ts"
import { projectCultivatorWithTrainingToCombatV6 } from "./project-cultivator-with-training.ts"
import type {
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  ProjectCultivatorWithTrainingAndSectInput,
} from "./types.ts"

function applyPanelContribution(
  attrs: LineupUnit["attrs"],
  contribution: CombatV6PanelContribution,
): void {
  const mutableAttrs = attrs as Record<string, number | undefined>
  const current = mutableAttrs[contribution.attr] ?? 0
  mutableAttrs[contribution.attr] =
    contribution.mode === "add"
      ? Math.floor(current + contribution.value)
      : Math.floor(current * contribution.value)
}

export function projectCultivatorWithTrainingAndSectToCombatV6(
  input: ProjectCultivatorWithTrainingAndSectInput,
): CombatV6ProjectionResult {
  const base = projectCultivatorWithTrainingToCombatV6(input)
  const versions = { ...COMBAT_V6_PHASE_3_VERSIONS }
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }

  const compiled = compileSectCombatV6({
    progress: input.sect,
    characterLevel: base.unit.level ?? 0,
  })
  if (!compiled.ok) {
    return {
      ok: false,
      diagnostics: [...base.diagnostics, ...compiled.diagnostics],
      versions,
    }
  }

  const diagnostics: CombatV6ProjectionDiagnostic[] = [
    ...base.diagnostics,
    ...compiled.projection.diagnostics,
  ]
  const attrs: LineupUnit["attrs"] = { ...base.unit.attrs }
  const hpBefore = attrs.hp
  for (const contribution of compiled.projection.panel) {
    applyPanelContribution(attrs, contribution)
  }
  if (attrs.maxHp !== undefined) {
    attrs.hp = input.resourcePolicy === "full" ? attrs.maxHp : Math.min(hpBefore, attrs.maxHp)
  }

  return {
    ok: true,
    unit: {
      ...base.unit,
      attrs,
      skills: compiled.projection.activeSkillIds,
      passives: compiled.projection.passiveSkillIds,
      skillLevels: compiled.projection.skillLevels,
      skillOverrides: compiled.projection.skillOverrides,
      resources: compiled.projection.resources,
      tags: [...(base.unit.tags ?? []), ...compiled.projection.unitTags],
    },
    skills: compiled.projection.skills,
    statusDefs: compiled.projection.statusDefs,
    diagnostics,
    versions,
  }
}
