import {
  DamageKind,
  DamageOrigin,
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  TargetSide,
  type SkillDef,
  type SkillHook,
} from "../core/index.ts"
import type { CharacterManualDefV1, ManualRankV1 } from "./types.ts"

export const CHARACTER_MANUAL_LINEAGE_ID = {
  Duanyue: "character_manual.lineage.duanyue",
  Ningguang: "character_manual.lineage.ningguang",
  Pojun: "character_manual.lineage.pojun",
  Fenling: "character_manual.lineage.fenling",
  Yinxue: "character_manual.lineage.yinxue",
  Huyuan: "character_manual.lineage.huyuan",
  Huisheng: "character_manual.lineage.huisheng",
  Dinghun: "character_manual.lineage.dinghun",
  Mingsi: "character_manual.lineage.mingsi",
  Shengxi: "character_manual.lineage.shengxi",
} as const

const MANUAL_KEYS = Object.keys(CHARACTER_MANUAL_LINEAGE_ID) as Array<keyof typeof CHARACTER_MANUAL_LINEAGE_ID>

export const CHARACTER_MANUAL_ID = Object.fromEntries(
  MANUAL_KEYS.flatMap((key) => {
    const slug = CHARACTER_MANUAL_LINEAGE_ID[key].split(".").slice(-1)[0]
    return [[`${key}Base`, `character_manual.${slug}.base`], [`${key}True`, `character_manual.${slug}.true`]]
  }),
) as Record<`${keyof typeof CHARACTER_MANUAL_LINEAGE_ID}${"Base" | "True"}`, string>

export const CHARACTER_MANUAL_PASSIVE_ID = Object.fromEntries(
  Object.entries(CHARACTER_MANUAL_ID).map(([key, id]) => [key, id.replace("character_manual.", "character_manual.passive.")]),
) as typeof CHARACTER_MANUAL_ID

const direct = [DamageOrigin.ActionDirect]

function passive(id: string, name: string, hooks: SkillHook[]): SkillDef {
  return {
    id,
    name,
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    hooks,
  }
}

function definition(
  key: keyof typeof CHARACTER_MANUAL_LINEAGE_ID,
  rank: ManualRankV1,
  label: string,
  description: string,
  options: Pick<CharacterManualDefV1, "skill" | "panel" | "capability">,
): CharacterManualDefV1 {
  const suffix = rank === "base" ? "Base" : "True"
  const idKey = `${key}${suffix}` as keyof typeof CHARACTER_MANUAL_ID
  return {
    id: CHARACTER_MANUAL_ID[idKey],
    lineageId: CHARACTER_MANUAL_LINEAGE_ID[key],
    rank,
    name: rank === "base" ? `《${label}诀》` : `《${label}真解》`,
    description,
    conflictGroups: [],
    ...options,
  }
}

function critManual(
  key: "Duanyue" | "Ningguang",
  label: string,
  kind: typeof DamageKind.Physical | typeof DamageKind.Spell,
  rank: ManualRankV1,
  chance: number,
): CharacterManualDefV1 {
  const idKey = `${key}${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  return definition(key, rank, label, `主动直接${kind === DamageKind.Physical ? "物理" : "法术"}伤害暴击率提高${chance * 100}个百分点。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `${label}·${rank}`, [{
      on: HookName.OnCritRoll,
      sourceIsSelf: true,
      requireKind: kind,
      when: { damageOrigins: direct },
      effects: [{ type: EffectType.ModifyChance, add: chance }],
    }]),
    capability: {
      capabilityKey: `offense.crit.${kind}.direct`,
      stackPolicy: "stack",
      priority: rank === "true" ? 20 : 10,
      strength: chance,
    },
  })
}

function damageManual(
  key: "Pojun" | "Fenling",
  label: string,
  kind: typeof DamageKind.Physical | typeof DamageKind.Spell,
  rank: ManualRankV1,
  factor: number,
): CharacterManualDefV1 {
  const idKey = `${key}${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  return definition(key, rank, label, `主动直接${kind === DamageKind.Physical ? "物理" : "法术"}伤害提高${Math.round((factor - 1) * 100)}%。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `${label}·${rank}`, [{
      on: HookName.OnHitCalc,
      sourceIsSelf: true,
      requireKind: kind,
      when: { damageOrigins: direct },
      effects: [{ type: EffectType.ModifyStrike, factor }],
    }]),
    capability: {
      capabilityKey: `offense.damage.${kind}.direct`,
      stackPolicy: "stack",
      priority: rank === "true" ? 20 : 10,
      strength: factor,
    },
  })
}

function yinxue(rank: ManualRankV1, ratio: number, cap: number): CharacterManualDefV1 {
  const idKey = `Yinxue${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  return definition("Yinxue", rank, "饮血", `主动直接物理伤害后恢复实际伤害的${ratio * 100}%，单次行动不超过最大气血的${cap * 100}%。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `饮血·${rank}`, [{
      on: HookName.AfterHit,
      sourceIsSelf: true,
      requireKind: DamageKind.Physical,
      aim: HookAim.Self,
      when: { damageOrigins: direct },
      effects: [{ type: EffectType.RestoreHp, power: `floor(hpDamage * ${ratio})`, maxGainPerAction: `floor(maxHp * ${cap})` }],
    }]),
    capability: {
      capabilityKey: "sustain.lifesteal.physical.direct",
      stackPolicy: "highest",
      priority: rank === "true" ? 20 : 10,
      strength: ratio,
    },
  })
}

function huyuan(rank: ManualRankV1, reduction: number): CharacterManualDefV1 {
  const idKey = `Huyuan${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  return definition("Huyuan", rank, "护元", `气血低于50%时，受到的物理和法术打击伤害降低${reduction * 100}%。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `护元·${rank}`, [{
      on: HookName.OnHitCalc,
      targetIsSelf: true,
      when: { sourceHpRatioBelow: 0.5, damageOrigins: direct },
      effects: [{ type: EffectType.ModifyStrike, factor: 1 - reduction }],
    }]),
    capability: {
      capabilityKey: "survival.low-hp-damage-reduction",
      stackPolicy: "highest",
      priority: rank === "true" ? 20 : 10,
      strength: reduction,
    },
  })
}

function huisheng(rank: ManualRankV1, chance: number, ratio: number): CharacterManualDefV1 {
  const idKey = `Huisheng${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  return definition("Huisheng", rank, "回生", `每场首次致命事件有${chance * 100}%概率复起，并恢复${ratio * 100}%最大气血。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `回生·${rank}`, [{
      on: HookName.OnFatal,
      targetIsSelf: true,
      aim: HookAim.Self,
      chance,
      when: { oncePerBattle: true },
      limitConsumption: "onAttempt",
      effects: [{ type: EffectType.RestoreHp, power: `floor(maxHp * ${ratio})`, revive: true, clearStatuses: true }],
    }]),
    capability: {
      capabilityKey: "survival.revive-on-fatal",
      stackPolicy: "unique",
      priority: rank === "true" ? 20 : 10,
      strength: ratio,
    },
  })
}

function roundRestore(
  key: "Mingsi" | "Shengxi",
  label: string,
  rank: ManualRankV1,
  ratio: number,
): CharacterManualDefV1 {
  const idKey = `${key}${rank === "base" ? "Base" : "True"}` as keyof typeof CHARACTER_MANUAL_PASSIVE_ID
  const mp = key === "Mingsi"
  return definition(key, rank, label, `回合结束时恢复${mp ? "最大法力" : "最大气血"}的${ratio * 100}%。`, {
    skill: passive(CHARACTER_MANUAL_PASSIVE_ID[idKey], `${label}·${rank}`, [{
      on: HookName.OnRoundEnd,
      aim: HookAim.Self,
      when: { sourceStanding: true },
      effects: [mp
        ? { type: EffectType.RestoreMp, power: `max(1, floor(maxMp * ${ratio}))` }
        : { type: EffectType.RestoreHp, power: `max(1, floor(maxHp * ${ratio}))` }],
    }]),
    capability: {
      capabilityKey: mp ? "sustain.round-end.mp" : "sustain.round-end.hp",
      stackPolicy: "highest",
      priority: rank === "true" ? 20 : 10,
      strength: ratio,
    },
  })
}

export const CHARACTER_MANUALS_V1: readonly CharacterManualDefV1[] = [
  critManual("Duanyue", "断岳", DamageKind.Physical, "base", 0.05),
  critManual("Duanyue", "断岳", DamageKind.Physical, "true", 0.1),
  critManual("Ningguang", "凝光", DamageKind.Spell, "base", 0.05),
  critManual("Ningguang", "凝光", DamageKind.Spell, "true", 0.1),
  damageManual("Pojun", "破军", DamageKind.Physical, "base", 1.05),
  damageManual("Pojun", "破军", DamageKind.Physical, "true", 1.1),
  damageManual("Fenling", "焚灵", DamageKind.Spell, "base", 1.05),
  damageManual("Fenling", "焚灵", DamageKind.Spell, "true", 1.1),
  yinxue("base", 0.1, 0.15),
  yinxue("true", 0.15, 0.25),
  huyuan("base", 0.08),
  huyuan("true", 0.15),
  huisheng("base", 0.2, 0.2),
  huisheng("true", 0.3, 0.3),
  definition("Dinghun", "base", "定魂", "封禁抵抗提高10点。", { panel: [{ attr: "sealResist", mode: "add", value: 10 }] }),
  definition("Dinghun", "true", "定魂", "封禁抵抗提高20点。", { panel: [{ attr: "sealResist", mode: "add", value: 20 }] }),
  roundRestore("Mingsi", "冥思", "base", 0.02),
  roundRestore("Mingsi", "冥思", "true", 0.04),
  roundRestore("Shengxi", "生息", "base", 0.01),
  roundRestore("Shengxi", "生息", "true", 0.02),
]
