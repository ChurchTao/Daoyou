import type { Attributes } from "@shared/types/cultivator"
import { compileSectCombatV6 } from "../content/index.ts"
import {
  ATTR_NAMES,
  type AttrName,
  type LineupUnit,
} from "../core/index.ts"
import { compileDaoEquipmentLoadoutV1 } from "../equipment/index.ts"
import { COMBAT_V6_PHASE_4A_VERSIONS } from "../version.ts"
import { compileBodyCultivationV6 } from "./body-cultivation-v6.ts"
import { compileCharacterPanelV1 } from "./character-panel-v1.ts"
import { projectCultivatorBaseToCombatV6 } from "./project-cultivator-base.ts"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  CompareDaoEquipmentLoadoutsV1Input,
  CompareDaoEquipmentLoadoutsV1Result,
  ProjectCultivatorWithEquipmentInput,
} from "./types.ts"

const ATTRIBUTE_KEYS = [
  "vitality",
  "strength",
  "spirit",
  "endurance",
  "speed",
  "willpower",
] as const satisfies readonly (keyof Attributes)[]

function hasErrors(diagnostics: CombatV6ProjectionDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error")
}

function applyContribution(
  attrs: LineupUnit["attrs"],
  contribution: CombatV6PanelContribution,
): void {
  const values = attrs as Record<string, number | undefined>
  const current = values[contribution.attr] ?? 0
  values[contribution.attr] = contribution.mode === "add"
    ? Math.floor(current + contribution.value)
    : Math.floor(current * contribution.value)
}

function applyPersistentResources(
  input: ProjectCultivatorWithEquipmentInput,
  attrs: LineupUnit["attrs"],
  diagnostics: CombatV6ProjectionDiagnostic[],
): void {
  if (input.resourcePolicy === "full") {
    attrs.hp = attrs.maxHp ?? attrs.hp
    attrs.mp = attrs.maxMp ?? 0
    return
  }
  const resources = input.cultivator.condition?.resources
  if (!resources) {
    diagnostics.push({
      severity: "error",
      code: "MISSING_PERSISTENT_RESOURCES",
      message: "persistent 资源策略要求角色存在当前气血和法力",
      path: "cultivator.condition.resources",
    })
    return
  }
  const currentHp = resources.hp?.current
  const currentMp = resources.mp?.current
  if (!Number.isFinite(currentHp)) {
    diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前气血必须是有限数", path: "cultivator.condition.resources.hp.current" })
  }
  if (!Number.isFinite(currentMp)) {
    diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前法力必须是有限数", path: "cultivator.condition.resources.mp.current" })
  }
  if (!Number.isFinite(currentHp) || !Number.isFinite(currentMp)) return

  const maxHp = attrs.maxHp ?? attrs.hp
  const maxMp = attrs.maxMp ?? 0
  attrs.hp = Math.min(maxHp, Math.max(0, currentHp!))
  attrs.mp = Math.min(maxMp, Math.max(0, currentMp!))
  if (attrs.hp !== currentHp) {
    diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前气血已夹取到 0～${maxHp}`, path: "cultivator.condition.resources.hp.current" })
  }
  if (attrs.mp !== currentMp) {
    diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前法力已夹取到 0～${maxMp}`, path: "cultivator.condition.resources.mp.current" })
  }
  if (attrs.hp <= 0) {
    diagnostics.push({ severity: "error", code: "PERSISTENT_HP_DEPLETED", message: "当前气血为 0 的角色不能进入战斗", path: "cultivator.condition.resources.hp.current" })
  }
}

function panelAttrs(attributes: Attributes): LineupUnit["attrs"] {
  const panel = compileCharacterPanelV1(attributes)
  return {
    hp: panel.maxHp,
    maxHp: panel.maxHp,
    mp: panel.maxMp,
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
  }
}

export function projectCultivatorWithEquipmentToCombatV6(
  input: ProjectCultivatorWithEquipmentInput,
): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_PHASE_4A_VERSIONS }
  if (input.sect.sectId !== "lingxiao") return { ok: false, diagnostics: [{ severity: "error", code: "INVALID_SECT_ID", message: "character_equipment_v1 只接受红尘剑宗", path: "sect.sectId" }], versions }
  const base = projectCultivatorBaseToCombatV6({ ...input, resourcePolicy: "full" })
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }

  const equipment = compileDaoEquipmentLoadoutV1(input.equipment, base.unit.level ?? 0)
  if (!equipment.ok) {
    return { ok: false, diagnostics: [...base.diagnostics, ...equipment.diagnostics], versions }
  }

  const effectiveAttributes = { ...input.cultivator.attributes }
  for (const key of ATTRIBUTE_KEYS) {
    effectiveAttributes[key] += equipment.projection.attributeBonuses[key]
  }
  const characterPanel = compileCharacterPanelV1(effectiveAttributes)
  const training = compileBodyCultivationV6(
    input.cultivator.condition?.tracks.bodyCultivation,
    characterPanel,
  )
  const sect = compileSectCombatV6({
    progress: input.sect,
    characterLevel: base.unit.level ?? 0,
  })
  const diagnostics = [
    ...base.diagnostics,
    ...equipment.projection.diagnostics,
    ...training.diagnostics,
    ...(sect.ok ? sect.projection.diagnostics : sect.diagnostics),
  ]
  if (!sect.ok || hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  const attrs = panelAttrs(effectiveAttributes)
  attrs.maxHp = (attrs.maxHp ?? 0) + training.maxHpBonus
  attrs.healPower = (attrs.healPower ?? 0) + training.healPowerBonus
  attrs.attackCultivate = training.attackCultivate
  attrs.defenseCultivate = training.defenseCultivate
  attrs.spellCultivate = training.spellCultivate
  attrs.resistSpellCultivate = training.resistSpellCultivate

  for (const roll of equipment.projection.panel) {
    applyContribution(attrs, { attr: roll.attr, mode: "add", value: roll.value })
  }
  for (const contribution of sect.projection.panel) applyContribution(attrs, contribution)
  applyPersistentResources(input, attrs, diagnostics)
  if (hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  return {
    ok: true,
    unit: {
      ...base.unit,
      attrs,
      skills: sect.projection.activeSkillIds,
      passives: sect.projection.passiveSkillIds,
      skillLevels: sect.projection.skillLevels,
      skillOverrides: sect.projection.skillOverrides,
      resources: sect.projection.resources,
      tags: [...(base.unit.tags ?? []), ...sect.projection.unitTags],
    },
    skills: sect.projection.skills,
    statusDefs: sect.projection.statusDefs,
    diagnostics,
    versions,
  }
}

function equipmentAttributes(
  input: Omit<ProjectCultivatorWithEquipmentInput, "equipment">,
  loadout: ProjectCultivatorWithEquipmentInput["equipment"],
): Attributes | undefined {
  const base = projectCultivatorBaseToCombatV6({ ...input, resourcePolicy: "full" })
  if (!base.ok) return undefined
  const compiled = compileDaoEquipmentLoadoutV1(loadout, base.unit.level ?? 0)
  return compiled.ok ? compiled.projection.attributeBonuses : undefined
}

export function compareDaoEquipmentLoadoutsV1(
  input: CompareDaoEquipmentLoadoutsV1Input,
): CompareDaoEquipmentLoadoutsV1Result {
  const { before, after, ...common } = input
  const beforeResult = projectCultivatorWithEquipmentToCombatV6({ ...common, equipment: before })
  const afterResult = projectCultivatorWithEquipmentToCombatV6({ ...common, equipment: after })
  if (!beforeResult.ok || !afterResult.ok) {
    return {
      ok: false,
      beforeDiagnostics: beforeResult.diagnostics,
      afterDiagnostics: afterResult.diagnostics,
    }
  }

  const beforeAttributes = equipmentAttributes(common, before)!
  const afterAttributes = equipmentAttributes(common, after)!
  const effectiveAttributeDiffs = Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, afterAttributes[key] - beforeAttributes[key]]),
  ) as unknown as Attributes
  const panelDiffs: Partial<Record<AttrName, number>> = {}
  for (const attr of ATTR_NAMES) {
    const difference = (afterResult.unit.attrs[attr] ?? 0) - (beforeResult.unit.attrs[attr] ?? 0)
    if (difference !== 0) panelDiffs[attr] = difference
  }

  return {
    ok: true,
    effectiveAttributeDiffs,
    panelDiffs,
    beforeDiagnostics: beforeResult.diagnostics,
    afterDiagnostics: afterResult.diagnostics,
  }
}
