import { EffectType, type SkillDef, type SkillEffect } from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import type {
  CompileSectCombatV6Input,
  CompileSectCombatV6Result,
  MeridianNodeDefV6,
  SectSkillDefV6,
  SkillPatchV6,
} from "./types.ts"

const diagnostic = (
  severity: "warning" | "error",
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic => ({ severity, code, message, path })

function hasErrors(items: CombatV6ProjectionDiagnostic[]): boolean {
  return items.some((item) => item.severity === "error")
}

function cloneSkill(skill: SkillDef): SkillDef {
  return structuredClone(skill)
}

function allSkillDefs(input: CompileSectCombatV6Input): SectSkillDefV6[] {
  return [
    ...input.definition.skills,
    ...input.definition.paths.flatMap((path) => [
      ...(path.foundationPassives ?? []),
      ...(path.grantSkills ?? []),
      ...path.nodes.flatMap((node) => [
        ...(node.passives ?? []),
        ...(node.grantSkills ?? []),
      ]),
    ]),
  ]
}

function validateDefinition(
  input: CompileSectCombatV6Input,
  diagnostics: CombatV6ProjectionDiagnostic[],
): void {
  const { definition } = input
  if (input.progress.sectId !== definition.id) {
    diagnostics.push(diagnostic("error", "SECT_DEFINITION_MISMATCH", "宗门定义与战斗进度不一致", "sectId"))
  }
  const slots = definition.methods.map((method) => method.slot)
  if (
    definition.methods.length !== 6 ||
    new Set(slots).size !== 6 ||
    ![1, 2, 3, 4, 5, 6].every((slot) => slots.includes(slot as 1)) ||
    definition.methods.filter((method) => method.isPrimary).length !== 1
  ) {
    diagnostics.push(diagnostic("error", "INVALID_METHOD_SET", "宗门必须包含槽位1～6且恰好一本主心法", "definition.methods"))
  }
  if (definition.paths.length !== 2) {
    diagnostics.push(diagnostic("error", "INVALID_ACTIVE_PATH", "宗门必须恰好定义两条流派", "definition.paths"))
  }
  for (const path of definition.paths) {
    for (const node of path.nodes) {
      if (node.pathId !== path.id) diagnostics.push(diagnostic("error", "SECT_DEFINITION_MISMATCH", `节点 ${node.id} 的流派归属不一致`, `definition.paths.${path.id}.nodes.${node.id}`))
    }
    for (let layer = 1; layer <= 7; layer++) {
      const nodes = path.nodes.filter((node) => node.layer === layer)
      if (nodes.length !== 3 || new Set(nodes.map((node) => node.slot)).size !== 3) {
        diagnostics.push(diagnostic("error", "INVALID_MERIDIAN_LOADOUT", `${path.name}第${layer}层必须恰好三个互斥节点`, `definition.paths.${path.id}`))
      }
    }
  }

  const ids = [
    ...definition.methods.map((method) => method.id),
    ...allSkillDefs(input).map((skill) => skill.definition.id),
    ...definition.statuses.map((status) => status.id),
    ...definition.paths.map((path) => path.id),
    ...new Set(definition.paths.flatMap((path) => (path.resources ?? []).map((resource) => resource.id))),
    ...definition.paths.flatMap((path) => path.nodes.map((node) => node.id)),
  ]
  if (new Set(ids).size !== ids.length) {
    diagnostics.push(diagnostic("error", "CONTENT_ID_CONFLICT", "宗门内容 ID 必须全局唯一", "definition"))
  }
  const methodIds = new Set(definition.methods.map((method) => method.id))
  for (const skill of allSkillDefs(input)) {
    if (!methodIds.has(skill.sourceMethodId)) {
      diagnostics.push(diagnostic("error", "SKILL_SOURCE_METHOD_MISSING", `技能 ${skill.definition.id} 缺少所属心法`, `skills.${skill.definition.id}`))
    }
    const successEffects = skill.definition.successEffects ?? []
    if (
      skill.definition.targeting.requireStatusIds?.some((id) => !id) ||
      skill.definition.targeting.requireStatusKinds?.some((kind) => !kind)
    ) {
      diagnostics.push(diagnostic("error", "INVALID_TARGET_STATUS_REQUIREMENT", `技能 ${skill.definition.id} 的目标状态要求非法`, `skills.${skill.definition.id}.targeting`))
    }
    for (const effect of successEffects) {
      if (!effect || !Object.values(EffectType).includes(effect.type)) {
        diagnostics.push(diagnostic("error", "INVALID_SUCCESS_EFFECT", `技能 ${skill.definition.id} 的成功结算效果非法`, `skills.${skill.definition.id}.successEffects`))
      }
    }
    const validateEffects = (effects: SkillEffect[], nested = false): void => {
    for (const effect of effects) {
      if (effect.targeting && !["enemy", "ally", "self", "any"].includes(effect.targeting.side)) {
        diagnostics.push(diagnostic("error", "INVALID_EFFECT_TARGETING", `技能 ${skill.definition.id} 的效果级目标非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.FixedHit && effect.formula && effect.formula !== "fixed" && effect.formula !== "judge") {
        diagnostics.push(diagnostic("error", "INVALID_FIXED_DAMAGE_CONTENT", `技能 ${skill.definition.id} 的固定伤害公式非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.Wound && typeof effect.power === "number" && (!Number.isFinite(effect.power) || effect.power < 0)) {
        diagnostics.push(diagnostic("error", "INVALID_WOUND_VALUE", `技能 ${skill.definition.id} 的伤势值非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.RemoveWound && typeof effect.power === "number" && (!Number.isFinite(effect.power) || effect.power < 0)) {
        diagnostics.push(diagnostic("error", "INVALID_WOUND_REDUCTION", `技能 ${skill.definition.id} 的疗伤值非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.ApplyBarrier) {
        if (!effect.id || !effect.kind || !effect.name) diagnostics.push(diagnostic("error", "INVALID_BARRIER_CONTENT", `技能 ${skill.definition.id} 的护盾定义不完整`, `skills.${skill.definition.id}.effects`))
        if (typeof effect.power === "number" && (!Number.isFinite(effect.power) || effect.power < 0)) diagnostics.push(diagnostic("error", "INVALID_BARRIER_VALUE", `技能 ${skill.definition.id} 的护盾值非法`, `skills.${skill.definition.id}.effects`))
        if (typeof effect.duration === "number" && (!Number.isFinite(effect.duration) || effect.duration < 1)) diagnostics.push(diagnostic("error", "INVALID_BARRIER_DURATION", `技能 ${skill.definition.id} 的护盾持续非法`, `skills.${skill.definition.id}.effects`))
      }
      if ((effect.type === EffectType.PhysicalHit || effect.type === EffectType.SpellHit) && typeof effect.defenseIgnore === "number" && (!Number.isFinite(effect.defenseIgnore) || effect.defenseIgnore < 0 || effect.defenseIgnore > 1)) {
        diagnostics.push(diagnostic("error", "INVALID_SPELL_DEFENSE_IGNORE", `技能 ${skill.definition.id} 的忽防值非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.Dispel) {
        const priority = effect.categoryPriority ?? []
        if (
          (typeof effect.maxCount === "number" && (!Number.isFinite(effect.maxCount) || effect.maxCount < 0)) ||
          new Set(priority).size !== priority.length
        ) {
          diagnostics.push(diagnostic("error", "INVALID_DISPEL_POLICY", `技能 ${skill.definition.id} 的净化策略非法`, `skills.${skill.definition.id}.effects`))
        }
      }
      if (effect.type === EffectType.RemoveStatus && !(effect.statusIds?.length || effect.kinds?.length)) {
        diagnostics.push(diagnostic("error", "INVALID_STATUS_REMOVAL", `技能 ${skill.definition.id} 的状态消费缺少匹配条件`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.CopyStatus && !(effect.statusIds?.length || effect.kinds?.length)) {
        diagnostics.push(diagnostic("error", "INVALID_STATUS_COPY", `技能 ${skill.definition.id} 的状态复制缺少匹配条件`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.type === EffectType.EmitMechanic && (!effect.mechanicId || !effect.name)) {
        diagnostics.push(diagnostic("error", "INVALID_MECHANIC_EVENT", `技能 ${skill.definition.id} 的机制事件定义非法`, `skills.${skill.definition.id}.effects`))
      }
      if (effect.when?.targetStatusStack) {
        const spec = effect.when.targetStatusStack
        if ((!spec.statusId && !spec.kind) || (spec.min !== undefined && (!Number.isFinite(spec.min) || spec.min < 0)) || (spec.max !== undefined && (!Number.isFinite(spec.max) || spec.max < 0 || (spec.min !== undefined && spec.max < spec.min)))) {
          diagnostics.push(diagnostic("error", "INVALID_STATUS_STACK_REQUIREMENT", `技能 ${skill.definition.id} 的状态层数条件非法`, `skills.${skill.definition.id}.effects`))
        }
      }
      if (effect.type === EffectType.RandomBranch) {
        if (!effect.branchId) {
          diagnostics.push(diagnostic("error", "INVALID_CHANCE_BRANCH", `技能 ${skill.definition.id} 的概率分支非法`, `skills.${skill.definition.id}.effects`))
        }
        if (typeof effect.chance === "number" && (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1)) diagnostics.push(diagnostic("error", "INVALID_CHANCE_VALUE", `技能 ${skill.definition.id} 的概率值非法`, `skills.${skill.definition.id}.effects`))
        if (nested) diagnostics.push(diagnostic("error", "NESTED_CHANCE_BRANCH_UNSUPPORTED", `技能 ${skill.definition.id} 不支持嵌套概率分支`, `skills.${skill.definition.id}.effects`))
        validateEffects(effect.successEffects, true)
        validateEffects(effect.failureEffects, true)
      }
      if ((effect.type === EffectType.PhysicalHit || effect.type === EffectType.SpellHit || effect.type === EffectType.FixedHit) && effect.cannotKill !== undefined && typeof effect.cannotKill !== "boolean") {
        diagnostics.push(diagnostic("error", "INVALID_NONLETHAL_HIT", `技能 ${skill.definition.id} 的非致命声明非法`, `skills.${skill.definition.id}.effects`))
      }
    }
    }
    validateEffects([...skill.definition.effects, ...successEffects])
  }
}

function validateProgress(
  input: CompileSectCombatV6Input,
  diagnostics: CombatV6ProjectionDiagnostic[],
): MeridianNodeDefV6[] {
  const { definition, progress } = input
  const methodIds = definition.methods.map((method) => method.id)
  const progressMethodIds = Object.keys(progress.methods)
  if (progressMethodIds.length !== 6 || methodIds.some((id) => !progressMethodIds.includes(id))) {
    diagnostics.push(diagnostic("error", "INVALID_METHOD_SET", "战斗进度必须完整提供六本心法等级", "progress.methods"))
  }
  const cap = Math.min(180, Math.max(0, Math.floor(input.characterLevel)) + 10)
  for (const method of definition.methods) {
    const level = progress.methods[method.id]
    if (!Number.isFinite(level) || level < 0) {
      diagnostics.push(diagnostic("error", "INVALID_METHOD_LEVEL", `${method.name}等级必须是非负有限数`, `progress.methods.${method.id}`))
    } else if (level > cap) {
      diagnostics.push(diagnostic("error", "METHOD_LEVEL_CAP_EXCEEDED", `${method.name}等级超过人物上限${cap}`, `progress.methods.${method.id}`))
    }
  }
  const primary = definition.methods.find((method) => method.isPrimary)
  const primaryLevel = primary ? progress.methods[primary.id] : undefined
  if (Number.isFinite(primaryLevel)) {
    for (const method of definition.methods.filter((entry) => !entry.isPrimary)) {
      if ((progress.methods[method.id] ?? 0) > primaryLevel!) {
        diagnostics.push(diagnostic("error", "BRANCH_METHOD_EXCEEDS_PRIMARY", `${method.name}不能高于主心法`, `progress.methods.${method.id}`))
      }
    }
  }

  const path = definition.paths.find((entry) => entry.id === progress.activePathId)
  if (!path) {
    diagnostics.push(diagnostic("error", "INVALID_ACTIVE_PATH", "当前流派不存在", "progress.activePathId"))
    return []
  }
  const expectedPathIds = new Set(definition.paths.map((entry) => entry.id))
  if (
    progress.meridianLoadouts.length !== 2 ||
    new Set(progress.meridianLoadouts.map((loadout) => loadout.pathId)).size !== 2 ||
    progress.meridianLoadouts.some((loadout) => !expectedPathIds.has(loadout.pathId))
  ) {
    diagnostics.push(diagnostic("error", "INVALID_MERIDIAN_LOADOUT", "两条流派必须各有且只有一套经脉方案", "progress.meridianLoadouts"))
    return []
  }
  for (const candidate of progress.meridianLoadouts) {
    const candidatePath = definition.paths.find((entry) => entry.id === candidate.pathId)
    if (!candidatePath) continue
    for (const nodeId of candidate.nodeIds) {
      if (!candidatePath.nodes.some((node) => node.id === nodeId)) {
        const belongsElsewhere = definition.paths.some((entry) => entry.id !== candidate.pathId && entry.nodes.some((node) => node.id === nodeId))
        diagnostics.push(diagnostic("error", belongsElsewhere ? "MERIDIAN_NODE_WRONG_PATH" : "MERIDIAN_NODE_UNKNOWN", `经脉节点 ${nodeId} 不属于方案 ${candidate.pathId}`, `progress.meridianLoadouts.${candidate.pathId}`))
      }
    }
  }
  const loadout = progress.meridianLoadouts.find((entry) => entry.pathId === path.id)!
  const nodes: MeridianNodeDefV6[] = []
  const selectedLayers = new Set<number>()
  for (const nodeId of loadout.nodeIds) {
    const node = path.nodes.find((entry) => entry.id === nodeId)
    if (!node) {
      const belongsElsewhere = definition.paths.some((entry) => entry.id !== path.id && entry.nodes.some((candidate) => candidate.id === nodeId))
      diagnostics.push(diagnostic("error", belongsElsewhere ? "MERIDIAN_NODE_WRONG_PATH" : "MERIDIAN_NODE_UNKNOWN", `经脉节点 ${nodeId} 不属于当前流派`, `progress.meridianLoadouts.${path.id}`))
      continue
    }
    if (node.layer > progress.meridianDepth) {
      diagnostics.push(diagnostic("error", "MERIDIAN_NODE_LOCKED", `${node.name}所在层尚未解锁`, `progress.meridianLoadouts.${path.id}`))
      continue
    }
    if (selectedLayers.has(node.layer)) {
      diagnostics.push(diagnostic("error", "MERIDIAN_LAYER_CONFLICT", `第${node.layer}层只能选择一个节点`, `progress.meridianLoadouts.${path.id}`))
      continue
    }
    selectedLayers.add(node.layer)
    nodes.push(node)
  }
  for (let layer = 1; layer <= progress.meridianDepth; layer++) {
    if (!selectedLayers.has(layer)) {
      diagnostics.push(diagnostic("warning", "MERIDIAN_SELECTION_INCOMPLETE", `${path.name}第${layer}层尚未选择节点`, `progress.meridianLoadouts.${path.id}`))
    }
  }
  return nodes.sort((a, b) => a.layer - b.layer || a.slot - b.slot)
}

function patchConflictKey(patch: SkillPatchV6): string | undefined {
  if (patch.operation === "setRequireHpRatio") return `${patch.skillId}:requireHpRatio`
  if (patch.operation === "capRequireHpRatio") return undefined
  if (patch.operation === "setCostHp") return `${patch.skillId}:costHp`
  if (patch.operation === "setTargetCount") return `${patch.skillId}:targeting.count`
  if (patch.operation === "setPhysicalDefenseIgnore") return `${patch.skillId}:physical.defenseIgnore`
  if (patch.operation === "setPhysicalCannotMiss") return `${patch.skillId}:physical.cannotMiss`
  if (patch.operation === "setSealBase") return `${patch.skillId}:sealBase`
  if (patch.operation === "setStatusDuration") return undefined
  if (patch.operation === "replaceStatusId") return `${patch.skillId}:status.${patch.from}.id`
  return undefined
}

function applyPatch(skill: SkillDef, patch: SkillPatchV6): SkillDef {
  const next = cloneSkill(skill)
  if (patch.operation === "setRequireHpRatio") next.requireHpRatio = patch.value
  if (patch.operation === "capRequireHpRatio") {
    next.requireHpRatio = Math.min(next.requireHpRatio ?? 1, patch.value)
  }
  if (patch.operation === "setCostHp") next.costHp = patch.value
  if (patch.operation === "setTargetCount") next.targeting.count = patch.value
  if (patch.operation === "addResourceTargetCount") {
    next.targeting.countByResource = [
      ...(next.targeting.countByResource ?? []),
      { resourceId: patch.resourceId, min: patch.min, count: patch.value },
    ]
  }
  if (patch.operation === "appendEffect") next.effects.push(structuredClone(patch.effect))
  if (patch.operation === "prependEffect") next.effects.unshift(structuredClone(patch.effect))
  if (patch.operation === "removeEffectType") {
    next.effects = next.effects.filter((effect) => effect.type !== patch.effectType)
  }
  if (patch.operation === "setEffectTargetCount") {
    next.effects = next.effects.map((effect) => effect.type === patch.effectType
      ? { ...effect, targeting: { ...(effect.targeting ?? next.targeting), count: patch.value } }
      : effect)
  }
  if (patch.operation === "setCopyStatusDurationAdd") {
    next.effects = next.effects.map((effect) => effect.type === EffectType.CopyStatus
      ? { ...effect, durationAdd: patch.value }
      : effect)
  }
  if (patch.operation === "multiplyRestoreMpPower") {
    next.effects = next.effects.map((effect) => effect.type === EffectType.RestoreMp
      ? { ...effect, power: `(${effect.power}) * ${patch.value}` }
      : effect)
  }
  if (patch.operation === "multiplyCostMp") next.costMp = `(${next.costMp ?? 0}) * ${patch.value}`
  if (patch.operation === "setRandomBranchChance") {
    next.effects = next.effects.map((effect) => effect.type === EffectType.RandomBranch && effect.branchId === patch.branchId
      ? { ...effect, chance: patch.value }
      : effect)
  }
  if (patch.operation === "setRandomBranchFixedPower") {
    next.effects = next.effects.map((effect) => effect.type === EffectType.RandomBranch && effect.branchId === patch.branchId
      ? {
          ...effect,
          successEffects: effect.successEffects.map((child) => child.type === EffectType.FixedHit ? { ...child, power: patch.value } : child),
        }
      : effect)
  }
  if (patch.operation === "setEffectPower" || patch.operation === "multiplyEffectPower") {
    next.effects = next.effects.map((effect) => {
      if (effect.type !== patch.effectType || !("power" in effect)) return effect
      if (patch.primaryTargetStatusId && !effect.when?.primaryTargetStatusIds?.includes(patch.primaryTargetStatusId)) return effect
      return {
        ...effect,
        power: patch.operation === "setEffectPower" ? patch.value : `(${effect.power ?? 0}) * ${patch.value}`,
      }
    })
  }
  if (patch.operation === "multiplyPhysicalCoefficients") {
    next.effects = next.effects.map((effect) => {
      if (effect.type !== EffectType.PhysicalHit) return effect
      const physical = effect as Extract<SkillEffect, { type: typeof EffectType.PhysicalHit }>
      const coeffs: number[] = Array.isArray(physical.coeff)
        ? physical.coeff
        : [physical.coeff ?? 1]
      return { ...effect, coeff: coeffs.map((value) => value * patch.value) }
    })
  }
  if (patch.operation === "addPhysicalCoefficient") {
    next.effects = next.effects.map((effect) => {
      if (effect.type !== EffectType.PhysicalHit) return effect
      const physical = effect as Extract<SkillEffect, { type: typeof EffectType.PhysicalHit }>
      const hits = typeof physical.hits === "number"
        ? physical.hits
        : Array.isArray(physical.coeff)
          ? physical.coeff.length
          : 1
      const scalarCoeff = typeof physical.coeff === "number" ? physical.coeff : 1
      const coeffs: number[] = Array.isArray(physical.coeff)
        ? [...physical.coeff]
        : Array.from({ length: hits }, () => scalarCoeff)
      coeffs[patch.hitIndex] = (coeffs[patch.hitIndex] ?? 0) + patch.value
      return { ...effect, hits: Math.max(hits, patch.hitIndex + 1), coeff: coeffs }
    })
  }
  if (patch.operation === "setPhysicalDefenseIgnore") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.PhysicalHit ? { ...effect, defenseIgnore: patch.value } : effect,
    )
  }
  if (patch.operation === "setPhysicalCannotMiss") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.PhysicalHit ? { ...effect, cannotMiss: patch.value } : effect,
    )
  }
  if (patch.operation === "multiplyFixedPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.FixedHit
        ? { ...effect, power: `(${effect.power ?? 0}) * ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "multiplyWoundPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.Wound
        ? { ...effect, power: `(${effect.power ?? 0}) * ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "multiplyHealPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.Heal
        ? { ...effect, power: `(${effect.power}) * ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "multiplyBarrierPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.ApplyBarrier
        ? { ...effect, power: `(${effect.power}) * ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "multiplyRemoveWoundPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.RemoveWound
        ? { ...effect, power: `(${effect.power}) * ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "setDispelMaxCount") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.Dispel ? { ...effect, maxCount: patch.value } : effect,
    )
  }
  if (patch.operation === "setDispelExcludeStatusFlags") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.Dispel ? { ...effect, excludeStatusFlags: [...patch.value] } : effect,
    )
  }
  if (patch.operation === "setReviveRatio") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.Revive && (
        patch.whenStatusId === undefined ||
        (patch.statusPresent === true && effect.when?.requireStatusIds?.includes(patch.whenStatusId)) ||
        (patch.statusPresent === false && effect.when?.requireAbsentStatusIds?.includes(patch.whenStatusId))
      ) ? { ...effect, hpRatio: patch.value } : effect,
    )
  }
  if (patch.operation === "addSpellDefenseIgnore") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.SpellHit
        ? { ...effect, defenseIgnore: `(${effect.defenseIgnore ?? 0}) + ${patch.value}` }
        : effect,
    )
  }
  if (patch.operation === "multiplySpellCoefficients") {
    next.effects = next.effects.map((effect) => {
      if (effect.type !== EffectType.SpellHit) return effect
      const coeffs = Array.isArray(effect.coeff) ? effect.coeff : [effect.coeff ?? 1]
      return { ...effect, coeff: coeffs.map((value) => value * patch.value) }
    })
  }
  if (patch.operation === "addSpellPower") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.SpellHit
        ? { ...effect, power: `(${effect.power ?? 0}) + (${patch.value})` }
        : effect,
    )
  }
  if (patch.operation === "setSplash") next.splash = { perTarget: patch.perTarget, floor: patch.floor }
  if (patch.operation === "appendSuccessEffect") {
    next.successEffects = [...(next.successEffects ?? []), structuredClone(patch.effect)]
  }
  if (patch.operation === "setBarrierDuration") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.ApplyBarrier && effect.id === patch.barrierId
        ? { ...effect, duration: patch.value }
        : effect,
    )
  }
  if (patch.operation === "setSealBase") next.sealBase = patch.value
  if (patch.operation === "addSealBase") next.sealBase = (next.sealBase ?? 0) + patch.value
  if (patch.operation === "setStatusDuration") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.ApplyStatus && effect.statusId === patch.statusId
        ? { ...effect, duration: patch.value }
        : effect,
    )
  }
  if (patch.operation === "replaceStatusId") {
    next.effects = next.effects.map((effect) =>
      effect.type === EffectType.ApplyStatus && effect.statusId === patch.from
        ? { ...effect, statusId: patch.to }
        : effect,
    )
  }
  return next
}

export function compileSectDefinitionV6(input: CompileSectCombatV6Input): CompileSectCombatV6Result {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  validateDefinition(input, diagnostics)
  const selectedNodes = validateProgress(input, diagnostics)
  if (hasErrors(diagnostics)) return { ok: false, diagnostics }

  const methodLevels = input.progress.methods
  const activePath = input.definition.paths.find((path) => path.id === input.progress.activePathId)!
  const grantedSkills = [
    ...input.definition.skills,
    ...(activePath.foundationPassives ?? []),
    ...(activePath.grantSkills ?? []),
    ...selectedNodes.flatMap((node) => [...(node.passives ?? []), ...(node.grantSkills ?? [])]),
  ].filter((skill) => (methodLevels[skill.sourceMethodId] ?? 0) >= skill.unlockMethodLevel)
  const definedSkillIds = new Set(allSkillDefs(input).map((skill) => skill.definition.id))
  const revokedIds = new Set([
    ...(activePath.revokeSkillIds ?? []),
    ...selectedNodes.flatMap((node) => node.revokeSkillIds ?? []),
  ])
  for (const id of revokedIds) {
    if (!definedSkillIds.has(id)) {
      diagnostics.push(diagnostic("error", "PATCH_TARGET_MISSING", `revoke 目标 ${id} 不存在`, `revoke.${id}`))
    }
  }
  if (hasErrors(diagnostics)) return { ok: false, diagnostics }
  const selectedSkills = grantedSkills.filter((skill) => !revokedIds.has(skill.definition.id))
  const byId = new Map<string, SkillDef>()
  for (const skill of selectedSkills) byId.set(skill.definition.id, cloneSkill(skill.definition))

  const conflicts = new Set<string>()
  const seenSetPatches = new Set<string>()
  const activePatches = [
    ...(activePath.patches ?? []),
    ...selectedNodes.flatMap((node) => node.patches ?? []),
  ]
  for (const patch of activePatches) {
    const target = byId.get(patch.skillId)
    if (!definedSkillIds.has(patch.skillId)) {
      diagnostics.push(diagnostic("error", "PATCH_TARGET_MISSING", `经脉 patch 目标 ${patch.skillId} 不存在`, `patches.${patch.skillId}`))
      continue
    }
    if (!target) continue
    const key = patchConflictKey(patch)
    if (key && seenSetPatches.has(key)) {
      conflicts.add(key)
      diagnostics.push(diagnostic("error", "PATCH_CONFLICT", `多个节点同时覆盖 ${key}`, `patches.${patch.skillId}`))
      continue
    }
    if (key) seenSetPatches.add(key)
    byId.set(patch.skillId, applyPatch(target, patch))
  }
  if (conflicts.size || hasErrors(diagnostics)) return { ok: false, diagnostics }

  const activeSkillIds: string[] = []
  const passiveSkillIds: string[] = []
  const skillLevels: Record<string, number> = {}
  for (const authored of selectedSkills) {
    const id = authored.definition.id
    skillLevels[id] = methodLevels[authored.sourceMethodId] ?? 0
    if (authored.kind === "active") activeSkillIds.push(id)
    else passiveSkillIds.push(id)
  }

  const patchedIds = new Set(activePatches.map((patch) => patch.skillId))
  return {
    ok: true,
    projection: {
      skills: [...byId.values()],
      statusDefs: input.definition.statuses.map((status) => structuredClone(status)),
      activeSkillIds: [...new Set(activeSkillIds)],
      passiveSkillIds: [...new Set(passiveSkillIds)],
      skillLevels,
      skillOverrides: [...patchedIds].filter((id) => byId.has(id)).map((id) => cloneSkill(byId.get(id)!)),
      resources: (activePath.resources ?? []).map((resource) => ({ ...resource })),
      panel: [
        ...input.definition.methods.flatMap((method) => {
          if (!method.panel) return []
          const level = methodLevels[method.id] ?? 0
          return [{ ...method.panel, value: Math.floor(method.panel.value * level) }]
        }),
        ...(activePath.panel ?? []).map((entry) => ({ ...entry })),
        ...selectedNodes.flatMap((node) => node.panel ?? []).map((entry) => ({ ...entry })),
      ],
      unitTags: [],
      diagnostics,
    },
  }
}
