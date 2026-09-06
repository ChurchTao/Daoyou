import {
  ATTR_NAMES,
  EffectType,
  Team,
  type LineupUnit,
  type SkillEffect,
} from "../core/index.ts"
import { projectCultivatorMultiSectV5ToCombatV6 } from "../projection/index.ts"
import { daoyouRulesetV5 } from "../rules-daoyou/index.ts"
import { COMBAT_V6_PHASE_6D_VERSIONS, COMBAT_V6_PHASE_7A_VERSIONS } from "../version.ts"
import { COMBAT_V6_TRAINING_CONTENT_V1 } from "./content.ts"
import type {
  CombatV6EncounterDiagnostic,
  CombatV6TrainingContentV1,
  CompileCombatV6TrainingEncounterV1Input,
  CompileCombatV6TrainingEncounterV1Result,
  PveCombatantDefV1,
} from "./types.ts"

const TIERS = new Set([60, 120, 180])

function error(code: CombatV6EncounterDiagnostic["code"], message: string, path?: string): CombatV6EncounterDiagnostic {
  return { severity: "error", code, message, path }
}

export function validateCombatV6TrainingContentV1(
  content: CombatV6TrainingContentV1 = COMBAT_V6_TRAINING_CONTENT_V1,
): CombatV6EncounterDiagnostic[] {
  const diagnostics: CombatV6EncounterDiagnostic[] = []
  const skillIds = uniqueIds(content.skills, "skills", diagnostics)
  const statusIds = uniqueIds(content.statusDefs, "statusDefs", diagnostics)
  for (const id of skillIds) {
    if (statusIds.has(id)) diagnostics.push(error("ENCOUNTER_CONTENT_ID_CONFLICT", `训练技能与状态 ID 冲突：${id}`))
  }
  const combatantKeys = new Set<string>()
  for (const [index, combatant] of content.combatants.entries()) {
    const path = `combatants[${index}]`
    const key = `${combatant.id}@${combatant.level}`
    if (!combatant.id || !combatant.name || combatantKeys.has(key)) diagnostics.push(error("INVALID_PVE_COMBATANT", `训练单位定义无效或重复：${key}`, path))
    combatantKeys.add(key)
    if (!TIERS.has(combatant.level)) diagnostics.push(error("UNKNOWN_TRAINING_TIER", `未知训练档位：${combatant.level}`, `${path}.level`))
    for (const attr of ATTR_NAMES) {
      const value = combatant.attrs[attr]
      if (!Number.isFinite(value) || value < 0) diagnostics.push(error("INVALID_PVE_ATTRIBUTE", `训练单位 ${combatant.id} 的 ${attr} 必须为有限非负数`, `${path}.attrs.${attr}`))
    }
    if (combatant.attrs.maxHp < 1 || combatant.attrs.hp < 1 || combatant.attrs.hp > combatant.attrs.maxHp) diagnostics.push(error("INVALID_PVE_ATTRIBUTE", `训练单位 ${combatant.id} 的气血范围无效`, `${path}.attrs.hp`))
    if (combatant.attrs.mp > combatant.attrs.maxMp) diagnostics.push(error("INVALID_PVE_ATTRIBUTE", `训练单位 ${combatant.id} 的法力超过上限`, `${path}.attrs.mp`))
    if (combatant.attrs.critRate > 1 || combatant.attrs.spellCritRate > 1 || combatant.attrs.physicalFuryRate > 1) diagnostics.push(error("INVALID_PVE_ATTRIBUTE", `训练单位 ${combatant.id} 的概率属性必须位于0至1`, `${path}.attrs`))
    for (const [skillId, level] of Object.entries(combatant.skillLevels)) {
      if (!combatant.skillIds.includes(skillId) && !combatant.passiveIds.includes(skillId)) diagnostics.push(error("INVALID_PVE_COMBATANT", `训练单位 ${combatant.id} 为未拥有技能设置等级 ${skillId}`, `${path}.skillLevels`))
      if (!Number.isFinite(level) || level < 0) diagnostics.push(error("INVALID_PVE_COMBATANT", `训练单位 ${combatant.id} 的技能等级无效 ${skillId}`, `${path}.skillLevels.${skillId}`))
    }
    for (const id of combatant.skillIds) if (!skillIds.has(id)) diagnostics.push(error("UNKNOWN_PVE_SKILL", `训练单位 ${combatant.id} 引用了未知技能 ${id}`, `${path}.skillIds`))
    for (const id of combatant.passiveIds) if (!skillIds.has(id)) diagnostics.push(error("UNKNOWN_PVE_PASSIVE", `训练单位 ${combatant.id} 引用了未知被动 ${id}`, `${path}.passiveIds`))
    validateStrategy(combatant, skillIds, diagnostics, path)
  }
  const encounterIds = new Set<string>()
  for (const [index, encounter] of content.encounters.entries()) {
    const path = `encounters[${index}]`
    if (!encounter.id || encounterIds.has(encounter.id)) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", `训练遭遇 ID 无效或重复：${encounter.id}`, `${path}.id`))
    encounterIds.add(encounter.id)
    if (!Number.isInteger(encounter.playerSlot) || encounter.playerSlot < 0) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", `训练遭遇 ${encounter.id} 的玩家站位无效`, `${path}.playerSlot`))
    const positions = new Set<string>([`0:${encounter.playerSlot}`])
    for (const [participantIndex, participant] of encounter.participants.entries()) {
      if ((participant.side !== Team.A && participant.side !== Team.B) || !Number.isInteger(participant.slot) || participant.slot < 0) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", `训练遭遇 ${encounter.id} 的参与者站位无效`, `${path}.participants[${participantIndex}]`))
      const position = `${participant.side}:${participant.slot}`
      if (positions.has(position)) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", `训练遭遇 ${encounter.id} 的站位重复：${position}`, `${path}.participants[${participantIndex}]`))
      positions.add(position)
      if (!content.combatants.some((candidate) => candidate.id === participant.combatantId)) diagnostics.push(error("UNKNOWN_PVE_COMBATANT", `训练遭遇 ${encounter.id} 引用了未知单位 ${participant.combatantId}`, `${path}.participants[${participantIndex}]`))
    }
    if (!encounter.participants.some((participant) => participant.side === Team.B)) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", `训练遭遇 ${encounter.id} 必须包含敌方单位`, path))
  }
  for (const [index, skill] of content.skills.entries()) validateEffects(skill.effects, statusIds, diagnostics, `skills[${index}].effects`)
  return diagnostics
}

export function compileCombatV6TrainingEncounterV1(
  input: CompileCombatV6TrainingEncounterV1Input,
  content: CombatV6TrainingContentV1 = COMBAT_V6_TRAINING_CONTENT_V1,
): CompileCombatV6TrainingEncounterV1Result {
  const versions = { ...COMBAT_V6_PHASE_7A_VERSIONS }
  const diagnostics = validateCombatV6TrainingContentV1(content)
  const encounter = content.encounters.find((candidate) => candidate.id === input.encounterId)
  if (!encounter) diagnostics.push(error("UNKNOWN_TRAINING_ENCOUNTER", `未知训练遭遇：${input.encounterId}`, "encounterId"))
  if (!TIERS.has(input.tier)) diagnostics.push(error("UNKNOWN_TRAINING_TIER", `未知训练档位：${input.tier}`, "tier"))
  if (!encounter || diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics, versions }

  const player = projectCultivatorMultiSectV5ToCombatV6({
    ...input.player,
    side: Team.A,
    slot: encounter.playerSlot,
    resourcePolicy: "full",
  })
  if (!player.ok) {
    diagnostics.push(...player.diagnostics.map((item) => error("PLAYER_PROJECTION_FAILED", `${item.code}: ${item.message}`, item.path)))
    return { ok: false, diagnostics, versions }
  }

  const npcStrategies: Record<string, PveCombatantDefV1["strategy"]> = {}
  const units: LineupUnit[] = [{ ...player.unit, side: Team.A, slot: encounter.playerSlot }]
  for (const participant of encounter.participants) {
    const definition = content.combatants.find((candidate) => candidate.id === participant.combatantId && candidate.level === input.tier)
    if (!definition) {
      diagnostics.push(error("UNKNOWN_PVE_COMBATANT", `训练档位 ${input.tier} 缺少单位 ${participant.combatantId}`))
      continue
    }
    const id = `${definition.id}:${participant.side}:${participant.slot}`
    units.push({
      id,
      name: definition.name,
      side: participant.side,
      kind: definition.kind,
      slot: participant.slot,
      level: definition.level,
      attrs: { ...definition.attrs },
      skills: [...definition.skillIds],
      passives: [...definition.passiveIds],
      skillLevels: { ...definition.skillLevels },
      tags: [...definition.tags],
    })
    npcStrategies[id] = clone(definition.strategy)
  }
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics, versions }

  const skills = mergeDefinitions([...player.skills, ...content.skills], "技能", diagnostics)
  const statusDefs = mergeDefinitions([...player.statusDefs, ...content.statusDefs], "状态", diagnostics)
  const cross = new Set(skills.map((definition) => definition.id))
  for (const definition of statusDefs) if (cross.has(definition.id)) diagnostics.push(error("ENCOUNTER_CONTENT_ID_CONFLICT", `战斗技能与状态 ID 冲突：${definition.id}`))
  if (new Set(units.map((unit) => unit.id)).size !== units.length) diagnostics.push(error("INVALID_ENCOUNTER_LINEUP", "训练遭遇包含重复单位 ID"))
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics, versions }

  return {
    ok: true,
    diagnostics,
    versions,
    compiled: {
      encounterId: encounter.id,
      tier: input.tier,
      seed: input.seed,
      playerId: player.unit.id!,
      npcStrategies,
      sourceProjectionVersions: { ...COMBAT_V6_PHASE_6D_VERSIONS },
      sourcePlayerInput: clone(input.player),
      battleInput: { seed: input.seed, versions, ruleset: daoyouRulesetV5, units, skills, statusDefs },
    },
  }
}

function uniqueIds(definitions: readonly { id: string }[], path: string, diagnostics: CombatV6EncounterDiagnostic[]): Set<string> {
  const ids = new Set<string>()
  for (const [index, definition] of definitions.entries()) {
    if (!definition.id || ids.has(definition.id)) diagnostics.push(error("ENCOUNTER_CONTENT_ID_CONFLICT", `训练内容 ID 无效或重复：${definition.id}`, `${path}[${index}].id`))
    ids.add(definition.id)
  }
  return ids
}

function validateStrategy(combatant: PveCombatantDefV1, skillIds: Set<string>, diagnostics: CombatV6EncounterDiagnostic[], path: string): void {
  if (combatant.strategy.type !== "defend" && combatant.strategy.type !== "attack" && combatant.strategy.type !== "skill-rotation") {
    diagnostics.push(error("INVALID_PVE_STRATEGY", `训练单位 ${combatant.id} 的策略无效`, `${path}.strategy`))
    return
  }
  if (combatant.strategy.type === "skill-rotation") {
    if (combatant.strategy.skillIds.length === 0) diagnostics.push(error("INVALID_PVE_STRATEGY", `训练单位 ${combatant.id} 的技能轮转不能为空`, `${path}.strategy.skillIds`))
    for (const id of combatant.strategy.skillIds) {
      if (!skillIds.has(id) || !combatant.skillIds.includes(id)) diagnostics.push(error("INVALID_PVE_STRATEGY", `训练单位 ${combatant.id} 无法轮转技能 ${id}`, `${path}.strategy.skillIds`))
    }
  }
}

function validateEffects(effects: readonly SkillEffect[], statusIds: Set<string>, diagnostics: CombatV6EncounterDiagnostic[], path: string): void {
  for (const [index, effect] of effects.entries()) {
    if (effect.type === EffectType.ApplyStatus && !statusIds.has(effect.statusId)) diagnostics.push(error("UNKNOWN_PVE_SKILL", `训练技能引用未知状态 ${effect.statusId}`, `${path}[${index}].statusId`))
    if (effect.type === EffectType.RandomBranch) {
      validateEffects(effect.successEffects, statusIds, diagnostics, `${path}[${index}].successEffects`)
      validateEffects(effect.failureEffects, statusIds, diagnostics, `${path}[${index}].failureEffects`)
    }
  }
}

function mergeDefinitions<T extends { id: string }>(definitions: readonly T[], label: string, diagnostics: CombatV6EncounterDiagnostic[]): T[] {
  const result = new Map<string, T>()
  for (const definition of definitions) {
    const previous = result.get(definition.id)
    if (!previous) result.set(definition.id, definition)
    else if (JSON.stringify(previous) !== JSON.stringify(definition)) diagnostics.push(error("ENCOUNTER_CONTENT_ID_CONFLICT", `${label} ID 定义冲突：${definition.id}`))
  }
  return [...result.values()].map(clone)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
