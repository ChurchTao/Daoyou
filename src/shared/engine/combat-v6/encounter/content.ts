import {
  DamageOrigin,
  EffectType,
  FormulaFamily,
  SkillTag,
  StatusCategory,
  StatusTick,
  TargetSide,
  TickKind,
  UnitKind,
  type Attrs,
  type SkillDef,
  type StatusDef,
} from "../core/index.ts"
import type { CombatV6EncounterDefV1, CombatV6TrainingContentV1, CombatV6TrainingTierV1, PveCombatantDefV1 } from "./types.ts"

export const TRAINING_ENCOUNTER_ID = {
  SingleDummy: "combat.training.encounter.single-dummy",
  SingleSparring: "combat.training.encounter.single-sparring",
  TripleDummy: "combat.training.encounter.triple-dummy",
  SupportRecovery: "combat.training.encounter.support-recovery",
  SupportCleanse: "combat.training.encounter.support-cleanse",
  SupportRevive: "combat.training.encounter.support-revive",
} as const

export const TRAINING_PVE_ID = {
  Dummy: "combat.training.npc.dummy",
  Sparring: "combat.training.npc.sparring",
  WoundedAlly: "combat.training.npc.wounded-ally",
  AfflictedAlly: "combat.training.npc.afflicted-ally",
  Afflicter: "combat.training.npc.afflicter",
  FragileAlly: "combat.training.npc.fragile-ally",
  Executioner: "combat.training.npc.executioner",
} as const

const SKILL = {
  Control: "combat.training.skill.control",
  Debuff: "combat.training.skill.debuff",
  Dot: "combat.training.skill.dot",
  Wound: "combat.training.skill.wound",
  Execute: "combat.training.skill.execute",
  Pause: "combat.training.skill.pause",
} as const

const STATUS = {
  Control: "combat.training.status.control",
  Debuff: "combat.training.status.debuff",
  Dot: "combat.training.status.dot",
} as const

export const COMBAT_V6_TRAINING_STATUS_DEFS_V1: readonly StatusDef[] = [
  { id: STATUS.Control, name: "训练封法", kind: STATUS.Control, category: StatusCategory.Control, blocksSpell: true },
  { id: STATUS.Debuff, name: "训练衰弱", kind: STATUS.Debuff, category: StatusCategory.Debuff, attrMods: { physicalAtk: -20, magicAtk: -20 } },
  { id: STATUS.Dot, name: "训练灼伤", kind: STATUS.Dot, category: StatusCategory.Dot, ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.02 } },
]

const hostile = { side: TargetSide.Enemy, count: 1 } as const
export const COMBAT_V6_TRAINING_SKILLS_V1: readonly SkillDef[] = [
  { id: SKILL.Control, name: "训练封禁", tags: [SkillTag.Spell, SkillTag.Support], targeting: hostile, effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Control, duration: 2 }] },
  { id: SKILL.Debuff, name: "训练衰弱", tags: [SkillTag.Spell, SkillTag.Support], targeting: hostile, effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Debuff, duration: 2 }] },
  { id: SKILL.Dot, name: "训练灼伤", tags: [SkillTag.Spell, SkillTag.Support], targeting: hostile, effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Dot, duration: 2 }] },
  { id: SKILL.Wound, name: "训练伤势", tags: [SkillTag.Spell, SkillTag.Support], targeting: hostile, effects: [{ type: EffectType.Wound, power: "skillLevel" }] },
  { id: SKILL.Execute, name: "训练击倒", tags: [SkillTag.Spell], formula: FormulaFamily.Fixed, targeting: hostile, effects: [{ type: EffectType.FixedHit, formula: FormulaFamily.Fixed, power: "target.maxHp", origin: DamageOrigin.ActionDirect }] },
  { id: SKILL.Pause, name: "训练停手", tags: [SkillTag.Support], targeting: { side: TargetSide.Self, count: 1 }, effects: [] },
]

const TIERS = [60, 120, 180] as const
const TIER_ATTRS: Record<CombatV6TrainingTierV1, Attrs> = {
  60: panel(6_000, 1_200, 420, 300, 120, 240, 60, 30, 6),
  120: panel(18_000, 2_400, 900, 650, 240, 420, 120, 60, 12),
  180: panel(36_000, 3_600, 1_450, 1_050, 360, 600, 180, 90, 18),
}

function panel(maxHp: number, maxMp: number, atk: number, def: number, speed: number, hit: number, dodge: number, seal: number, cultivate: number): Attrs {
  return { hp: maxHp, maxHp, mp: maxMp, maxMp, physicalAtk: atk, physicalDef: def, magicAtk: atk, magicDef: def, healPower: 0, speed, hit, dodge, critRate: 0, spellCritRate: 0, physicalFuryRate: 0, sealHit: seal, sealResist: seal, attackCultivate: cultivate, defenseCultivate: cultivate, spellCultivate: cultivate, resistSpellCultivate: cultivate }
}

function combatant(id: string, name: string, tier: CombatV6TrainingTierV1, options: Partial<PveCombatantDefV1> = {}): PveCombatantDefV1 {
  const base = TIER_ATTRS[tier]
  const { attrs, ...rest } = options
  return { id, name, level: tier, kind: UnitKind.Npc, skillIds: [], passiveIds: [], skillLevels: {}, tags: [], strategy: { type: "defend" }, ...rest, attrs: { ...base, ...(attrs ?? {}) } }
}

export const COMBAT_V6_TRAINING_COMBATANTS_V1: readonly PveCombatantDefV1[] = TIERS.flatMap((tier) => [
  combatant(TRAINING_PVE_ID.Dummy, "演武木桩", tier, { attrs: { ...TIER_ATTRS[tier], hp: TIER_ATTRS[tier].maxHp * 5, maxHp: TIER_ATTRS[tier].maxHp * 5, physicalAtk: 1, magicAtk: 1, speed: 1 } }),
  combatant(TRAINING_PVE_ID.Sparring, "演武陪练", tier, { strategy: { type: "attack" } }),
  combatant(TRAINING_PVE_ID.WoundedAlly, "负伤同伴", tier, { kind: UnitKind.Player, attrs: { ...TIER_ATTRS[tier], hp: Math.floor(TIER_ATTRS[tier].maxHp * 0.25), physicalAtk: 1, magicAtk: 1 }, strategy: { type: "defend" } }),
  combatant(TRAINING_PVE_ID.AfflictedAlly, "受术同伴", tier, { kind: UnitKind.Player, attrs: { ...TIER_ATTRS[tier], physicalAtk: 1, magicAtk: 1 }, strategy: { type: "defend" } }),
  combatant(TRAINING_PVE_ID.Afflicter, "术法陪练", tier, { attrs: { ...TIER_ATTRS[tier], physicalAtk: 1, magicAtk: 1, speed: TIER_ATTRS[tier].speed + 100 }, skillIds: [SKILL.Control, SKILL.Debuff, SKILL.Dot, SKILL.Wound], skillLevels: { [SKILL.Control]: tier, [SKILL.Debuff]: tier, [SKILL.Dot]: tier, [SKILL.Wound]: tier }, strategy: { type: "skill-rotation", skillIds: [SKILL.Control, SKILL.Debuff, SKILL.Dot, SKILL.Wound] } }),
  combatant(TRAINING_PVE_ID.FragileAlly, "待援同伴", tier, { kind: UnitKind.Player, attrs: { ...TIER_ATTRS[tier], hp: Math.max(1, tier), physicalAtk: 1, magicAtk: 1 }, strategy: { type: "defend" } }),
  combatant(TRAINING_PVE_ID.Executioner, "击倒陪练", tier, { attrs: { ...TIER_ATTRS[tier], physicalAtk: 1, magicAtk: 1, speed: TIER_ATTRS[tier].speed + 100 }, skillIds: [SKILL.Execute, SKILL.Pause], skillLevels: { [SKILL.Execute]: tier, [SKILL.Pause]: tier }, strategy: { type: "skill-rotation", skillIds: [SKILL.Execute, SKILL.Pause] } }),
])

function p(combatantId: string, side: 0 | 1, slot: number) { return { combatantId, side, slot } }
export const COMBAT_V6_TRAINING_ENCOUNTERS_V1: readonly CombatV6EncounterDefV1[] = [
  { id: TRAINING_ENCOUNTER_ID.SingleDummy, name: "单体木桩", playerSlot: 0, participants: [p(TRAINING_PVE_ID.Dummy, 1, 0)] },
  { id: TRAINING_ENCOUNTER_ID.SingleSparring, name: "攻击陪练", playerSlot: 0, participants: [p(TRAINING_PVE_ID.Sparring, 1, 0)] },
  { id: TRAINING_ENCOUNTER_ID.TripleDummy, name: "三体木桩", playerSlot: 0, participants: [p(TRAINING_PVE_ID.Dummy, 1, 0), p(TRAINING_PVE_ID.Dummy, 1, 1), p(TRAINING_PVE_ID.Dummy, 1, 2)] },
  { id: TRAINING_ENCOUNTER_ID.SupportRecovery, name: "治疗防护", playerSlot: 1, participants: [p(TRAINING_PVE_ID.WoundedAlly, 0, 0), p(TRAINING_PVE_ID.Dummy, 1, 0)] },
  { id: TRAINING_ENCOUNTER_ID.SupportCleanse, name: "净化训练", playerSlot: 1, participants: [p(TRAINING_PVE_ID.AfflictedAlly, 0, 0), p(TRAINING_PVE_ID.Afflicter, 1, 0)] },
  { id: TRAINING_ENCOUNTER_ID.SupportRevive, name: "复活训练", playerSlot: 1, participants: [p(TRAINING_PVE_ID.FragileAlly, 0, 0), p(TRAINING_PVE_ID.Executioner, 1, 0)] },
]

export const COMBAT_V6_TRAINING_CONTENT_V1: CombatV6TrainingContentV1 = {
  combatants: COMBAT_V6_TRAINING_COMBATANTS_V1,
  encounters: COMBAT_V6_TRAINING_ENCOUNTERS_V1,
  skills: COMBAT_V6_TRAINING_SKILLS_V1,
  statusDefs: COMBAT_V6_TRAINING_STATUS_DEFS_V1,
}
