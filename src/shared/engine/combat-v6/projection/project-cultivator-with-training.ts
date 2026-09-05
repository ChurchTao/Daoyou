import { COMBAT_V6_PHASE_2_VERSIONS } from "../version.ts"
import { compileBodyCultivationV6 } from "./body-cultivation-v6.ts"
import { compileCharacterPanelV1 } from "./character-panel-v1.ts"
import { projectCultivatorBaseToCombatV6 } from "./project-cultivator-base.ts"
import type {
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  ProjectCultivatorWithTrainingInput,
} from "./types.ts"

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function hasErrors(diagnostics: CombatV6ProjectionDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error")
}

export function projectCultivatorWithTrainingToCombatV6(
  input: ProjectCultivatorWithTrainingInput,
): CombatV6ProjectionResult {
  const baseResult = projectCultivatorBaseToCombatV6({
    ...input,
    resourcePolicy: "full",
  })
  const versions = { ...COMBAT_V6_PHASE_2_VERSIONS }

  if (!baseResult.ok) {
    return { ok: false, diagnostics: baseResult.diagnostics, versions }
  }

  const panel = compileCharacterPanelV1(input.cultivator.attributes)
  const training = compileBodyCultivationV6(
    input.cultivator.condition?.tracks.bodyCultivation,
    panel,
  )
  const diagnostics = [...baseResult.diagnostics, ...training.diagnostics]
  if (hasErrors(diagnostics)) {
    return { ok: false, diagnostics, versions }
  }

  const maxHp = panel.maxHp + training.maxHpBonus
  const maxMp = panel.maxMp
  let hp = maxHp
  let mp = maxMp

  if (input.resourcePolicy === "persistent") {
    const resources = input.cultivator.condition?.resources
    if (!resources) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_PERSISTENT_RESOURCES",
        message: "persistent 资源策略要求角色存在当前气血和法力",
        path: "cultivator.condition.resources",
      })
    } else {
      const currentHp = resources.hp?.current
      const currentMp = resources.mp?.current
      if (!Number.isFinite(currentHp)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_PERSISTENT_RESOURCE",
          message: "当前气血必须是有限数",
          path: "cultivator.condition.resources.hp.current",
        })
      }
      if (!Number.isFinite(currentMp)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_PERSISTENT_RESOURCE",
          message: "当前法力必须是有限数",
          path: "cultivator.condition.resources.mp.current",
        })
      }
      if (Number.isFinite(currentHp) && Number.isFinite(currentMp)) {
        hp = clamp(0, maxHp, currentHp!)
        mp = clamp(0, maxMp, currentMp!)
        if (hp !== currentHp) {
          diagnostics.push({
            severity: "warning",
            code: "RESOURCE_CLAMPED",
            message: `当前气血已夹取到 0～${maxHp}`,
            path: "cultivator.condition.resources.hp.current",
          })
        }
        if (mp !== currentMp) {
          diagnostics.push({
            severity: "warning",
            code: "RESOURCE_CLAMPED",
            message: `当前法力已夹取到 0～${maxMp}`,
            path: "cultivator.condition.resources.mp.current",
          })
        }
        if (hp <= 0) {
          diagnostics.push({
            severity: "error",
            code: "PERSISTENT_HP_DEPLETED",
            message: "当前气血为 0 的角色不能进入战斗",
            path: "cultivator.condition.resources.hp.current",
          })
        }
      }
    }
  }

  if (hasErrors(diagnostics)) {
    return { ok: false, diagnostics, versions }
  }

  return {
    ok: true,
    unit: {
      ...baseResult.unit,
      attrs: {
        ...baseResult.unit.attrs,
        hp,
        maxHp,
        mp,
        maxMp,
        healPower: panel.healPower + training.healPowerBonus,
        attackCultivate: training.attackCultivate,
        defenseCultivate: training.defenseCultivate,
        spellCultivate: training.spellCultivate,
        resistSpellCultivate: training.resistSpellCultivate,
      },
    },
    skills: [],
    statusDefs: [],
    diagnostics,
    versions,
  }
}
