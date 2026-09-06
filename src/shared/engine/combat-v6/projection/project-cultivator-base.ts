import { getRealmStageRank } from "@shared/config/realmProgression"
import type { Attributes } from "@shared/types/cultivator"
import { REALM_STAGE_VALUES, REALM_VALUES } from "@shared/types/constants"
import { UnitKind, type LineupUnit } from "../core/index.ts"
import { COMBAT_V6_PHASE_1_VERSIONS } from "../version.ts"
import { compileCharacterPanelV1 } from "./character-panel-v1.ts"
import type {
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  ProjectCultivatorBaseInput,
} from "./types.ts"

const ATTRIBUTE_KEYS = [
  "vitality",
  "strength",
  "spirit",
  "endurance",
  "speed",
  "willpower",
] as const satisfies readonly (keyof Attributes)[]

function diagnostic(
  severity: CombatV6ProjectionDiagnostic["severity"],
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic {
  return { severity, code, message, ...(path ? { path } : {}) }
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function hasErrors(diagnostics: CombatV6ProjectionDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error")
}

export function projectCultivatorBaseToCombatV6(
  input: ProjectCultivatorBaseInput,
): CombatV6ProjectionResult {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const { cultivator } = input

  if (typeof cultivator.id !== "string" || cultivator.id.trim().length === 0) {
    diagnostics.push(diagnostic("error", "INVALID_IDENTITY", "角色 id 不能为空", "cultivator.id"))
  }
  if (typeof cultivator.name !== "string" || cultivator.name.trim().length === 0) {
    diagnostics.push(diagnostic("error", "INVALID_IDENTITY", "角色名称不能为空", "cultivator.name"))
  }
  if (!REALM_VALUES.includes(cultivator.realm)) {
    diagnostics.push(diagnostic("error", "INVALID_IDENTITY", "角色境界无法映射", "cultivator.realm"))
  }
  if (!REALM_STAGE_VALUES.includes(cultivator.realm_stage)) {
    diagnostics.push(
      diagnostic("error", "INVALID_IDENTITY", "角色境界阶段无法映射", "cultivator.realm_stage"),
    )
  }
  if (!Number.isInteger(input.slot) || input.slot < 0) {
    diagnostics.push(diagnostic("error", "INVALID_IDENTITY", "阵容位置必须是非负整数", "slot"))
  }

  for (const key of ATTRIBUTE_KEYS) {
    const value = cultivator.attributes?.[key]
    if (!Number.isFinite(value) || value < 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "INVALID_BASE_ATTRIBUTE",
          `${key} 必须是有限非负数`,
          `cultivator.attributes.${key}`,
        ),
      )
    }
  }

  if ((cultivator.condition?.statuses.length ?? 0) > 0) {
    diagnostics.push(
      diagnostic(
        "warning",
        "PERSISTENT_STATUSES_NOT_PROJECTED",
        "Phase 1 不会把角色长期状态编译为 combat-v6 状态",
        "cultivator.condition.statuses",
      ),
    )
  }

  if (hasErrors(diagnostics)) {
    return { ok: false, diagnostics, versions: { ...COMBAT_V6_PHASE_1_VERSIONS } }
  }

  const panel = compileCharacterPanelV1(cultivator.attributes)
  let hp = panel.maxHp
  let mp = panel.maxMp

  if (input.resourcePolicy === "persistent") {
    const resources = cultivator.condition?.resources
    if (!resources) {
      diagnostics.push(
        diagnostic(
          "error",
          "MISSING_PERSISTENT_RESOURCES",
          "persistent 资源策略要求角色存在当前气血和法力",
          "cultivator.condition.resources",
        ),
      )
    } else {
      const currentHp = resources.hp?.current
      const currentMp = resources.mp?.current
      if (!Number.isFinite(currentHp)) {
        diagnostics.push(
          diagnostic(
            "error",
            "INVALID_PERSISTENT_RESOURCE",
            "当前气血必须是有限数",
            "cultivator.condition.resources.hp.current",
          ),
        )
      }
      if (!Number.isFinite(currentMp)) {
        diagnostics.push(
          diagnostic(
            "error",
            "INVALID_PERSISTENT_RESOURCE",
            "当前法力必须是有限数",
            "cultivator.condition.resources.mp.current",
          ),
        )
      }
      if (Number.isFinite(currentHp) && Number.isFinite(currentMp)) {
        hp = clamp(0, panel.maxHp, currentHp)
        mp = clamp(0, panel.maxMp, currentMp)
        if (hp !== currentHp) {
          diagnostics.push(
            diagnostic(
              "warning",
              "RESOURCE_CLAMPED",
              `当前气血已夹取到 0～${panel.maxHp}`,
              "cultivator.condition.resources.hp.current",
            ),
          )
        }
        if (mp !== currentMp) {
          diagnostics.push(
            diagnostic(
              "warning",
              "RESOURCE_CLAMPED",
              `当前法力已夹取到 0～${panel.maxMp}`,
              "cultivator.condition.resources.mp.current",
            ),
          )
        }
        if (hp <= 0) {
          diagnostics.push(
            diagnostic(
              "error",
              "PERSISTENT_HP_DEPLETED",
              "当前气血为 0 的角色不能进入战斗",
              "cultivator.condition.resources.hp.current",
            ),
          )
        }
      }
    }
  }

  if (hasErrors(diagnostics)) {
    return { ok: false, diagnostics, versions: { ...COMBAT_V6_PHASE_1_VERSIONS } }
  }

  const unit: LineupUnit = {
    id: cultivator.id,
    name: cultivator.name,
    side: input.side,
    kind: UnitKind.Player,
    slot: input.slot,
    level: (getRealmStageRank(cultivator.realm, cultivator.realm_stage) + 1) * 5,
    attrs: {
      hp,
      maxHp: panel.maxHp,
      mp,
      maxMp: panel.maxMp,
      physicalAtk: panel.physicalAtk,
      physicalDef: panel.physicalDef,
      magicAtk: panel.magicAtk,
      magicDef: panel.magicDef,
      healPower: panel.healPower,
      speed: panel.speed,
      hit: panel.hit,
      dodge: panel.dodge,
      critRate: panel.critRate,
      spellCritRate: panel.spellCritRate,
      physicalFuryRate: panel.physicalFuryRate,
      sealHit: panel.sealHit,
      sealResist: panel.sealResist,
      attackCultivate: 0,
      defenseCultivate: 0,
      spellCultivate: 0,
      resistSpellCultivate: 0,
    },
    skills: [],
    passives: [],
    skillLevels: {},
    skillOverrides: [],
    tags: [],
  }

  return {
    ok: true,
    unit,
    skills: [],
    statusDefs: [],
    diagnostics,
    versions: { ...COMBAT_V6_PHASE_1_VERSIONS },
  }
}
