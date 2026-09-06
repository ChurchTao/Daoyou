import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import { CHARACTER_MANUALS_V1 } from "./content.ts"
import { getManualSlotCount, isManualSlotV1, validateManualStateV1 } from "./compiler.ts"
import type {
  CharacterManualDefV1,
  CultivatorManualStateV1,
  ForgetManualV1Input,
  LearnManualV1Input,
  ManualStateChangeResult,
  ReplaceManualV1Input,
} from "./types.ts"

function error(
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): ManualStateChangeResult {
  return { ok: false, diagnostics: [{ severity: "error", code, message, path }] }
}

function cloneState(state: CultivatorManualStateV1): CultivatorManualStateV1 {
  return {
    version: 1,
    revision: state.revision,
    build: { slots: state.build.slots.map((entry) => ({ ...entry })) },
  }
}

function preflight(
  input: { state: CultivatorManualStateV1; realm: LearnManualV1Input["realm"]; expectedRevision: number },
  definitions: readonly CharacterManualDefV1[],
): ManualStateChangeResult | undefined {
  const diagnostics = validateManualStateV1(input.state, input.realm, definitions)
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== input.state.revision) {
    return error("INVALID_MANUAL_REVISION", "功法状态已变化，请刷新后重试", "expectedRevision")
  }
  return undefined
}

function definitionOf(
  id: string,
  definitions: readonly CharacterManualDefV1[],
): CharacterManualDefV1 | undefined {
  return definitions.find((item) => item.id === id)
}

function conflictWithBuild(
  definition: CharacterManualDefV1,
  state: CultivatorManualStateV1,
  definitions: readonly CharacterManualDefV1[],
): CharacterManualDefV1 | undefined {
  const groups = new Set(definition.conflictGroups)
  return state.build.slots
    .map((entry) => definitionOf(entry.manualId, definitions))
    .find((current): current is CharacterManualDefV1 =>
      Boolean(current && current.conflictGroups.some((group) => groups.has(group))),
    )
}

function lineageInBuild(
  definition: CharacterManualDefV1,
  state: CultivatorManualStateV1,
  definitions: readonly CharacterManualDefV1[],
): CharacterManualDefV1 | undefined {
  return state.build.slots
    .map((entry) => definitionOf(entry.manualId, definitions))
    .find((current) => current?.lineageId === definition.lineageId)
}

function success(state: CultivatorManualStateV1): ManualStateChangeResult {
  state.revision += 1
  state.build.slots.sort((left, right) => left.slot - right.slot)
  return { ok: true, state, diagnostics: [] }
}

export function learnManualV1(
  input: LearnManualV1Input,
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): ManualStateChangeResult {
  const failed = preflight(input, definitions)
  if (failed) return failed
  if (!isManualSlotV1(input.slot)) return error("MANUAL_SLOT_INVALID", "道印位必须位于1～6", "slot")
  if (input.slot > getManualSlotCount(input.realm)) return error("MANUAL_SLOT_LOCKED", `当前境界尚未解锁第${input.slot}道印位`, "slot")
  if (input.state.build.slots.some((entry) => entry.slot === input.slot)) return error("MANUAL_SLOT_OCCUPIED", `第${input.slot}道印位已有功法`, "slot")
  const definition = definitionOf(input.manualId, definitions)
  if (!definition) return error("UNKNOWN_MANUAL", `未知功法：${input.manualId}`, "manualId")
  const lineage = lineageInBuild(definition, input.state, definitions)
  if (lineage?.rank === "true" && definition.rank === "base") return error("MANUAL_RANK_DOWNGRADE", "已有同源真解，不能参悟本篇", "manualId")
  if (lineage) return error("MANUAL_LINEAGE_CONFLICT", "同一谱系只能保留一本功法", "manualId")
  if (input.state.build.slots.some((entry) => entry.manualId === definition.id)) return error("DUPLICATE_MANUAL", "不能重复参悟同一本功法", "manualId")
  const conflict = conflictWithBuild(definition, input.state, definitions)
  if (conflict) return error("MANUAL_CONFLICT_REQUIRES_FORGET", `必须先散去冲突功法 ${conflict.name}`, "manualId")
  const next = cloneState(input.state)
  next.build.slots.push({ slot: input.slot, manualId: definition.id })
  return success(next)
}

export function replaceManualV1(
  input: ReplaceManualV1Input,
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): ManualStateChangeResult {
  const failed = preflight(input, definitions)
  if (failed) return failed
  if (!isManualSlotV1(input.slot)) return error("MANUAL_SLOT_INVALID", "道印位必须位于1～6", "slot")
  if (input.slot > getManualSlotCount(input.realm)) return error("MANUAL_SLOT_LOCKED", `当前境界尚未解锁第${input.slot}道印位`, "slot")
  const current = input.state.build.slots.find((entry) => entry.slot === input.slot)
  if (!current) return error("MANUAL_SLOT_EMPTY", `第${input.slot}道印位为空`, "slot")
  if (current.manualId !== input.expectedManualId) return error("MANUAL_EXPECTED_MISMATCH", "目标道印内容已变化", "expectedManualId")
  const currentDefinition = definitionOf(current.manualId, definitions)!
  const nextDefinition = definitionOf(input.manualId, definitions)
  if (!nextDefinition) return error("UNKNOWN_MANUAL", `未知功法：${input.manualId}`, "manualId")
  if (currentDefinition.id === nextDefinition.id) return error("DUPLICATE_MANUAL", "新旧功法相同", "manualId")

  const withoutCurrent = cloneState(input.state)
  withoutCurrent.build.slots = withoutCurrent.build.slots.filter((entry) => entry.slot !== input.slot)
  const lineage = lineageInBuild(nextDefinition, withoutCurrent, definitions)
  if (lineage?.rank === "true" && nextDefinition.rank === "base") return error("MANUAL_RANK_DOWNGRADE", "已有同源真解，不能改修本篇", "manualId")
  if (lineage) return error("MANUAL_LINEAGE_CONFLICT", "同一谱系只能保留一本功法", "manualId")
  const sameLineageUpgrade = currentDefinition.lineageId === nextDefinition.lineageId && currentDefinition.rank === "base" && nextDefinition.rank === "true"
  if (currentDefinition.lineageId === nextDefinition.lineageId && !sameLineageUpgrade) {
    return error("MANUAL_RANK_DOWNGRADE", "同源功法只允许本篇原位升级真解", "manualId")
  }
  const conflict = conflictWithBuild(nextDefinition, withoutCurrent, definitions)
  if (conflict) return error("MANUAL_CONFLICT_REQUIRES_FORGET", `必须先散去冲突功法 ${conflict.name}`, "manualId")
  withoutCurrent.build.slots.push({ slot: input.slot, manualId: nextDefinition.id })
  return success(withoutCurrent)
}

export function forgetManualV1(
  input: ForgetManualV1Input,
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): ManualStateChangeResult {
  const failed = preflight(input, definitions)
  if (failed) return failed
  if (!isManualSlotV1(input.slot)) return error("MANUAL_SLOT_INVALID", "道印位必须位于1～6", "slot")
  if (input.slot > getManualSlotCount(input.realm)) return error("MANUAL_SLOT_LOCKED", `当前境界尚未解锁第${input.slot}道印位`, "slot")
  const current = input.state.build.slots.find((entry) => entry.slot === input.slot)
  if (!current) return error("MANUAL_SLOT_EMPTY", `第${input.slot}道印位为空`, "slot")
  if (current.manualId !== input.expectedManualId) return error("MANUAL_EXPECTED_MISMATCH", "目标道印内容已变化", "expectedManualId")
  const next = cloneState(input.state)
  next.build.slots = next.build.slots.filter((entry) => entry.slot !== input.slot)
  return success(next)
}
