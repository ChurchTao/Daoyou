import type { Attributes } from "@daoyou/game-domain/character"
import {
  DAO_RAGE_RESOURCE,
  DAO_EQUIPMENT_ARTS_V1,
  DAO_RAGE_RESOURCE_ID,
} from '@daoyou/game-content/equipment/special';
import { compileCurrentSectCombatV6 } from "../../sects/index.js"
import { type CombatV6VersionStamp, type LineupUnit } from '@daoyou/combat-core/types';
import { daoFormationInscriptionOf, DAO_FORMATION_INSCRIPTION_ID } from '@daoyou/game-content/equipment/base';
import { daoFormationPanel } from '../../equipment/inscriptions.js';
import { type DaoEquipmentInstanceV1 } from '@daoyou/game-domain/equipment';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../../equipment/compiler.js';
import { compileBodyCultivationV6 } from "./body-cultivation-v6.js"
import { compileCharacterPanelV1 } from "./character-panel-v1.js"
import { projectCultivatorBaseToCombatV6 } from "./project-cultivator-base.js"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  CharacterCombatInput,
} from "@daoyou/game-domain/combat"

const MERIDIAN_EQUIPMENT_ELEMENTS = new Set(['金', '火', '风']);

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

function applyContribution(attrs: LineupUnit["attrs"], contribution: CombatV6PanelContribution): void {
  const values = attrs as Record<string, number | undefined>
  const current = values[contribution.attr] ?? 0
  values[contribution.attr] = contribution.mode === "add"
    ? Math.floor(current + contribution.value)
    : Math.floor(current * contribution.value)
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

function applyResources(
  input: Omit<CharacterCombatInput, "manuals">,
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
    diagnostics.push({ severity: "error", code: "MISSING_PERSISTENT_RESOURCES", message: "persistent 资源策略要求角色存在当前气血和法力", path: "cultivator.condition.resources" })
    return
  }
  const currentHp = resources.hp?.current
  const currentMp = resources.mp?.current
  if (!Number.isFinite(currentHp)) diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前气血必须是有限数", path: "cultivator.condition.resources.hp.current" })
  if (!Number.isFinite(currentMp)) diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前法力必须是有限数", path: "cultivator.condition.resources.mp.current" })
  if (!Number.isFinite(currentHp) || !Number.isFinite(currentMp)) return
  const maxHp = attrs.maxHp ?? attrs.hp
  const maxMp = attrs.maxMp ?? 0
  attrs.hp = Math.min(maxHp, Math.max(0, currentHp!))
  attrs.mp = Math.min(maxMp, Math.max(0, currentMp!))
  if (attrs.hp !== currentHp) diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前气血已夹取到 0～${maxHp}`, path: "cultivator.condition.resources.hp.current" })
  if (attrs.mp !== currentMp) diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前法力已夹取到 0～${maxMp}`, path: "cultivator.condition.resources.mp.current" })
  if (attrs.hp <= 0) diagnostics.push({ severity: "error", code: "PERSISTENT_HP_DEPLETED", message: "当前气血为 0 的角色不能进入战斗", path: "cultivator.condition.resources.hp.current" })
}

function contentConflicts(
  sect: Extract<ReturnType<typeof compileCurrentSectCombatV6>, { ok: true }>["projection"],
  equipment: Extract<ReturnType<typeof compileDaoEquipmentSpecialLoadoutV1>, { ok: true }>["projection"],
): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const duplicate = (left: string[], right: string[], kind: string) => {
    for (const id of new Set(left.filter((candidate) => right.includes(candidate)))) {
      diagnostics.push({ severity: "error", code: "CONTENT_ID_CONFLICT", message: `${kind} ID 冲突：${id}` })
    }
  }
  duplicate(sect.skills.map((item) => item.id), equipment.skills.map((item) => item.id), "技能")
  duplicate(sect.statusDefs.map((item) => item.id), equipment.statusDefs.map((item) => item.id), "状态")
  duplicate(sect.resources.map((item) => item.id), [DAO_RAGE_RESOURCE_ID], "资源")
  const sectIds = [
    ...sect.skills.map((item) => item.id),
    ...sect.statusDefs.map((item) => item.id),
    ...sect.resources.map((item) => item.id),
  ]
  duplicate(sectIds, equipment.effectiveEssenceIds, "器蕴")
  duplicate(sectIds, equipment.grantedArtIds, "器诀")
  return diagnostics
}

export function projectCharacterEquipment(
  input: Omit<CharacterCombatInput, "manuals">,
  versions: CombatV6VersionStamp,
  includeEffectiveAttributes = false,
): CombatV6ProjectionResult {
  const base = projectCultivatorBaseToCombatV6({ ...input, resourcePolicy: "full" })
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }
  const equipment = compileDaoEquipmentSpecialLoadoutV1(input.equipment, base.unit.level ?? 0)
  if (!equipment.ok) return { ok: false, diagnostics: [...base.diagnostics, ...equipment.diagnostics], versions }

  const effectiveAttributes = { ...input.cultivator.attributes }
  for (const key of ATTRIBUTE_KEYS) effectiveAttributes[key] += equipment.projection.attributeBonuses[key]
  const characterPanel = compileCharacterPanelV1(effectiveAttributes)
  const equipmentContribution = (item: DaoEquipmentInstanceV1 | undefined, attr: 'maxHp' | 'physicalDef' | 'physicalAtk') =>
    [...(item?.baseStats ?? []), ...daoFormationPanel(item)].filter(r => r.attr === attr).reduce((sum, r) => sum + r.value, 0)
  const weaponXuanfeng = input.equipment.weapon?.formationInscriptions.flatMap(formation =>
    formation?.patternId === DAO_FORMATION_INSCRIPTION_ID.Xuanfeng ? [formation] : []) ?? []

  const training = compileBodyCultivationV6(input.cultivator.condition?.tracks.bodyCultivation, characterPanel)
  const sect = input.sect
    ? compileCurrentSectCombatV6({ progress: input.sect, characterLevel: base.unit.level ?? 0 })
    : undefined
  const diagnostics = [
    ...base.diagnostics,
    ...equipment.projection.diagnostics,
    ...training.diagnostics,
    ...(sect ? (sect.ok ? sect.projection.diagnostics : sect.diagnostics) : []),
  ]
  if (sect && !sect.ok) return { ok: false, diagnostics, versions }
  if (sect) diagnostics.push(...contentConflicts(sect.projection, equipment.projection))
  if (hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  const attrs = panelAttrs(effectiveAttributes)
  attrs.maxHp = (attrs.maxHp ?? 0) + training.maxHpBonus
  attrs.healPower = (attrs.healPower ?? 0) + training.healPowerBonus
  attrs.attackCultivate = training.attackCultivate
  attrs.defenseCultivate = training.defenseCultivate
  attrs.spellCultivate = training.spellCultivate
  attrs.resistSpellCultivate = training.resistSpellCultivate
  for (const roll of equipment.projection.panel) applyContribution(attrs, { attr: roll.attr, mode: "add", value: roll.value })
  for (const contribution of sect?.projection.panel ?? []) applyContribution(attrs, contribution)
  applyResources(input, attrs, diagnostics)
  if (hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  const artSkillIds = DAO_EQUIPMENT_ARTS_V1
    .filter((art) => equipment.projection.grantedArtIds.includes(art.id))
    .map((art) => art.skill.id)
  const artSkillLevels = Object.fromEntries(artSkillIds.map((id) => [id, 0]))
  return {
    ok: true,
    ...(includeEffectiveAttributes ? { effectiveAttributes } : {}),
    unit: {
      ...base.unit,
      attrs,
      skills: [...(sect?.projection.activeSkillIds ?? []), ...artSkillIds],
      passives: [...(sect?.projection.passiveSkillIds ?? []), ...equipment.projection.passiveSkillIds],
      skillLevels: { ...sect?.projection.skillLevels, ...artSkillLevels },
      skillOverrides: [...(sect?.projection.skillOverrides ?? []), ...equipment.projection.skillOverrides],
      resources: [
        ...(sect?.projection.resources ?? []),
        { ...DAO_RAGE_RESOURCE },
      ],
      combatFacts: {
        ...(input.sect?.sectId === "jiujie" ? {
        spiritPoints: effectiveAttributes.spirit,
        thunderMethodLevel: input.sect?.methods['jiujie.method.thunder'] ?? 0,
        metalWindThunderEquipmentCount: [input.equipment.weapon, input.equipment.armor].filter(e => e?.element && ['金', '风', '雷'].includes(e.element)).length,
        lingyaoMagicAtk: Object.values(input.equipment).reduce((sum, equipment) => sum + (equipment?.formationInscriptions ?? []).reduce((subtotal, formation) => subtotal + (formation?.patternId === DAO_FORMATION_INSCRIPTION_ID.Lingyao ? formation.level * daoFormationInscriptionOf(DAO_FORMATION_INSCRIPTION_ID.Lingyao)!.valuePerLevel : 0), 0), 0),
        } : {}),
        beltMaxHp: equipmentContribution(input.equipment.belt, 'maxHp'),
        beltPhysicalDef: equipmentContribution(input.equipment.belt, 'physicalDef'),
        wuxiang_wind_weapon: input.equipment.weapon?.element === '风' ? 1 : 0,
        weaponDamage: equipmentContribution(input.equipment.weapon, 'physicalAtk'),
        metalFireWindEquipmentCount: [input.equipment.weapon, input.equipment.armor].filter(e => e?.element && MERIDIAN_EQUIPMENT_ELEMENTS.has(e.element)).length,
        weaponXuanfengLevel: Math.max(0, ...weaponXuanfeng.map(formation => formation.level)),
        weaponXuanfengAttack: weaponXuanfeng.reduce((sum, formation) => sum + formation.level, 0) * daoFormationInscriptionOf(DAO_FORMATION_INSCRIPTION_ID.Xuanfeng)!.valuePerLevel,
      },
      tags: [...(input.equipment.weapon?.element && ['水', '冰', '土'].includes(input.equipment.weapon.element) ? ['equipment.weapon.water_ice_earth'] : []), ...(base.unit.tags ?? []), ...(sect?.projection.unitTags ?? []),
        ...([input.equipment.weapon, input.equipment.armor].every(e => e?.element && MERIDIAN_EQUIPMENT_ELEMENTS.has(e.element)) ? ['equipment.weapon_armor.metal_fire_wind'] : [])],
    },
    skills: [...(sect?.projection.skills ?? []), ...equipment.projection.skills],
    statusDefs: [...(sect?.projection.statusDefs ?? []), ...equipment.projection.statusDefs],
    diagnostics,
    versions,
  }
}
