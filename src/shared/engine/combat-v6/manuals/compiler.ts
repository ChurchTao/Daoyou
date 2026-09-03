import type { RealmType } from "@shared/types/constants"
import { SkillTag } from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import { CHARACTER_MANUALS_V1 } from "./content.ts"
import type {
  CharacterManualDefV1,
  CompileCharacterManualsV1Result,
  CultivatorManualStateV1,
  ManualSlotV1,
} from "./types.ts"

const SLOT_BY_REALM: Record<RealmType, number> = {
  炼气: 2,
  筑基: 3,
  金丹: 4,
  元婴: 5,
  化神: 6,
  炼虚: 6,
  合体: 6,
  大乘: 6,
  渡劫: 6,
}

export function getManualSlotCount(realm: RealmType): number {
  return SLOT_BY_REALM[realm]
}

function diagnostic(
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic {
  return { severity: "error", code, message, path }
}

function definitionDiagnostics(definitions: readonly CharacterManualDefV1[]): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const ids = [
    ...definitions.map((definition) => definition.id),
    ...definitions.flatMap((definition) => definition.skill ? [definition.skill.id] : []),
  ]
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    diagnostics.push(diagnostic("MANUAL_CONTENT_INVALID", "功法或被动内容 ID 缺失或重复"))
  }
  for (const definition of definitions) {
    const invalid =
      !definition.lineageId.trim() ||
      !definition.name.trim() ||
      !["base", "true"].includes(definition.rank) ||
      (!definition.skill && !(definition.panel?.length)) ||
      Boolean(definition.skill) !== Boolean(definition.capability) ||
      definition.skill?.tags.includes(SkillTag.Passive) === false ||
      (definition.skill?.effects.length ?? 0) > 0 ||
      definition.conflictGroups.some((group) => !group.trim()) ||
      new Set(definition.conflictGroups).size !== definition.conflictGroups.length ||
      (definition.panel ?? []).some((item) =>
        item.attr !== "sealResist" || item.mode !== "add" || !Number.isFinite(item.value),
      )
    if (invalid) diagnostics.push(diagnostic("MANUAL_CONTENT_INVALID", `功法内容无效：${definition.id}`))
  }
  const byLineage = new Map<string, CharacterManualDefV1[]>()
  for (const definition of definitions) {
    const list = byLineage.get(definition.lineageId) ?? []
    list.push(definition)
    byLineage.set(definition.lineageId, list)
  }
  for (const [lineageId, list] of byLineage) {
    if (list.length !== 2 || new Set(list.map((item) => item.rank)).size !== 2) {
      diagnostics.push(diagnostic("MANUAL_CONTENT_INVALID", `功法谱系必须各有一本本篇和真解：${lineageId}`))
    }
  }
  return diagnostics
}

export function validateManualStateV1(
  state: CultivatorManualStateV1,
  realm: RealmType,
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): CombatV6ProjectionDiagnostic[] {
  const diagnostics = definitionDiagnostics(definitions)
  if (!state || state.version !== 1 || !state.build || !Array.isArray(state.build.slots)) {
    return [...diagnostics, diagnostic("INVALID_MANUAL_STATE", "功法状态必须是 version=1 的唯一构筑")]
  }
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    diagnostics.push(diagnostic("INVALID_MANUAL_REVISION", "功法 revision 必须是非负整数", "revision"))
  }
  const definitionsById = new Map(definitions.map((item) => [item.id, item]))
  const occupiedSlots = new Set<number>()
  const manualIds = new Set<string>()
  const lineageIds = new Set<string>()
  const conflictGroups = new Map<string, string>()
  const unlocked = getManualSlotCount(realm)

  for (const [index, entry] of state.build.slots.entries()) {
    const path = `build.slots.${index}`
    if (!entry || typeof entry !== "object") {
      diagnostics.push(diagnostic("INVALID_MANUAL_STATE", "道印位记录必须是对象", path))
      continue
    }
    if (!Number.isInteger(entry.slot) || entry.slot < 1 || entry.slot > 6) {
      diagnostics.push(diagnostic("MANUAL_SLOT_INVALID", "道印位必须位于1～6", `${path}.slot`))
      continue
    }
    if (entry.slot > unlocked) diagnostics.push(diagnostic("MANUAL_SLOT_LOCKED", `当前境界尚未解锁第${entry.slot}道印位`, `${path}.slot`))
    if (occupiedSlots.has(entry.slot)) diagnostics.push(diagnostic("MANUAL_SLOT_OCCUPIED", `第${entry.slot}道印位重复占用`, `${path}.slot`))
    occupiedSlots.add(entry.slot)
    if (typeof entry.manualId !== "string" || !entry.manualId.trim()) {
      diagnostics.push(diagnostic("UNKNOWN_MANUAL", "功法 ID 不能为空", `${path}.manualId`))
      continue
    }
    if (manualIds.has(entry.manualId)) diagnostics.push(diagnostic("DUPLICATE_MANUAL", `功法重复：${entry.manualId}`, `${path}.manualId`))
    manualIds.add(entry.manualId)
    const definition = definitionsById.get(entry.manualId)
    if (!definition) {
      diagnostics.push(diagnostic("UNKNOWN_MANUAL", `未知功法：${entry.manualId}`, `${path}.manualId`))
      continue
    }
    if (lineageIds.has(definition.lineageId)) diagnostics.push(diagnostic("MANUAL_LINEAGE_CONFLICT", `同一功法谱系不能同时存在：${definition.lineageId}`, `${path}.manualId`))
    lineageIds.add(definition.lineageId)
    for (const group of definition.conflictGroups) {
      const previous = conflictGroups.get(group)
      if (previous && previous !== definition.id) diagnostics.push(diagnostic("MANUAL_CONFLICT_REQUIRES_FORGET", `冲突组 ${group} 中已有 ${previous}`, `${path}.manualId`))
      else conflictGroups.set(group, definition.id)
    }
  }
  return diagnostics
}

export function compileCharacterManualsV1(
  input: { state: CultivatorManualStateV1; realm: RealmType },
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): CompileCharacterManualsV1Result {
  const diagnostics = validateManualStateV1(input.state, input.realm, definitions)
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics }
  const byId = new Map(definitions.map((item) => [item.id, item]))
  const selected = [...input.state.build.slots]
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => byId.get(entry.manualId)!)
  const skills = selected.flatMap((definition) => definition.skill ? [definition.skill] : [])
  const capabilities = selected.flatMap((definition) =>
    definition.capability && definition.skill
      ? [{
          ...definition.capability,
          sourceType: "manual" as const,
          sourceId: definition.id,
          passiveIds: [definition.skill.id],
        }]
      : [],
  )
  return {
    ok: true,
    projection: {
      skills,
      passiveSkillIds: skills.map((skill) => skill.id),
      skillLevels: Object.fromEntries(skills.map((skill) => [skill.id, 0])),
      panel: selected.flatMap((definition) => definition.panel ?? []),
      unitTags: [...new Set(selected.flatMap((definition) => definition.unitTags ?? []))],
      capabilities,
      diagnostics,
    },
  }
}

export function isManualSlotV1(value: number): value is ManualSlotV1 {
  return Number.isInteger(value) && value >= 1 && value <= 6
}
