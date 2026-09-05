import { DEFAULT_DAMAGE_TAKEN, DEFAULT_HIT, MIN_HP, MIN_MAX_HP } from "./constants.ts"
import { DamageKind } from "./enums.ts"
import { clamp01, finiteOr } from "./math.ts"
import { overridesFrom } from "./skills.ts"
import type { Attrs, CombatResourceState, LineupUnit, StatusInstance, Unit } from "./types.ts"

/** 入场缺省属性。命中默认 100，保证木桩对打不因 0 命中而全空。 */
export const DEFAULT_ATTRS: Attrs = {
  hp: 0,
  maxHp: 0,
  mp: 0,
  maxMp: 0,
  physicalAtk: 0,
  physicalDef: 0,
  magicAtk: 0,
  magicDef: 0,
  healPower: 0,
  speed: 0,
  hit: DEFAULT_HIT,
  dodge: 0,
  critRate: 0,
  spellCritRate: 0,
  physicalFuryRate: 0,
  sealHit: 0,
  sealResist: 0,
  attackCultivate: 0,
  defenseCultivate: 0,
  spellCultivate: 0,
  resistSpellCultivate: 0,
}

export function createUnit(input: LineupUnit, index: number): Unit {
  const hp = Math.max(MIN_HP, Math.floor(finiteOr(input.attrs.hp, MIN_HP)))
  const mp = Math.max(0, Math.floor(finiteOr(input.attrs.mp ?? 0, 0)))
  const attrs: Attrs = {
    ...DEFAULT_ATTRS,
    ...input.attrs,
    hp,
    maxHp: Math.max(MIN_MAX_HP, Math.floor(finiteOr(input.attrs.maxHp ?? hp, hp))),
    mp,
    maxMp: Math.max(0, Math.floor(finiteOr(input.attrs.maxMp ?? mp, mp))),
    critRate: clamp01(input.attrs.critRate ?? 0),
    spellCritRate: clamp01(input.attrs.spellCritRate ?? 0),
    physicalFuryRate: clamp01(input.attrs.physicalFuryRate ?? 0),
  }
  return {
    id: input.id ?? `u${input.side}_${input.slot ?? index}`,
    name: input.name,
    side: input.side,
    kind: input.kind,
    slot: input.slot ?? index,
    level: Math.max(0, Math.floor(finiteOr(input.level ?? 0, 0))),
    ownerId: input.ownerId,
    attrs,
    wound: 0,
    skills: [...(input.skills ?? [])],
    passives: [...(input.passives ?? [])],
    skillLevels: { ...(input.skillLevels ?? {}) },
    skillOverrides: overridesFrom(input.skillOverrides),
    tags: [...(input.tags ?? [])],
    resources: normalizeResources(input.resources),
    barriers: [],
    marks: [],
    statuses: [],
    flags: {
      defending: false,
      auto: false,
      skipNextAction: false,
      downed: false,
      dead: false,
      escaped: false,
      benched: input.benched ?? false,
    },
  }
}

/** 场上可被选中、可出手：未死亡、未倒地、未逃跑、未坐板凳。 */
export function isStanding(unit: Unit): boolean {
  return !unit.flags.dead && !unit.flags.downed && !unit.flags.escaped && !unit.flags.benched
}

export function isActionable(unit: Unit): boolean {
  return isStanding(unit)
}

export function cloneUnit(unit: Unit): Unit {
  return {
    ...unit,
    attrs: { ...unit.attrs },
    skills: [...unit.skills],
    passives: [...unit.passives],
    skillLevels: { ...unit.skillLevels },
    skillOverrides: { ...unit.skillOverrides },
    tags: [...unit.tags],
    resources: unit.resources.map((resource) => ({ ...resource })),
    barriers: unit.barriers.map((barrier) => ({ ...barrier })),
    marks: [...unit.marks],
    statuses: unit.statuses.map((s) => ({ ...s, attrMods: { ...s.attrMods } })),
    flags: { ...unit.flags },
    command: unit.command ? { ...unit.command } : undefined,
    lastCommand: unit.lastCommand ? { ...unit.lastCommand } : undefined,
  }
}

function normalizeResources(resources: CombatResourceState[] | undefined): CombatResourceState[] {
  const seen = new Set<string>()
  const result: CombatResourceState[] = []
  for (const resource of resources ?? []) {
    if (!resource.id || seen.has(resource.id)) continue
    seen.add(resource.id)
    const max = Math.max(0, Math.floor(finiteOr(resource.max, 0)))
    const current = Math.min(max, Math.max(0, Math.floor(finiteOr(resource.current, 0))))
    result.push({ id: resource.id, name: resource.name, current, max })
  }
  return result
}

export function resourceOf(unit: Unit, id: string): CombatResourceState | undefined {
  return unit.resources.find((resource) => resource.id === id)
}

export function recoverableHp(unit: Unit): number {
  return Math.max(MIN_HP, unit.attrs.maxHp - Math.max(0, Math.floor(unit.wound)))
}

export function emptyStatusMods(): Pick<
  StatusInstance,
  "attrMods" | "damageTakenPhysical" | "damageTakenSpell" | "speedMod" | "healTaken" | "healDealt"
> {
  return {
    attrMods: {},
    damageTakenPhysical: DEFAULT_DAMAGE_TAKEN,
    damageTakenSpell: DEFAULT_DAMAGE_TAKEN,
    speedMod: 0,
    healTaken: DEFAULT_DAMAGE_TAKEN,
    healDealt: DEFAULT_DAMAGE_TAKEN,
  }
}

/** 面板 + 状态加减。出手速度、伤害计算都走这里，不要直接读 unit.attrs.speed。 */
export function effectiveAttrs(unit: Unit): Attrs {
  const attrs = { ...unit.attrs }
  for (const status of unit.statuses) {
    attrs.speed += status.speedMod
    for (const [key, value] of Object.entries(status.attrMods) as Array<[keyof Attrs, number]>) {
      attrs[key] += value
    }
  }
  return attrs
}

export function effectiveSpeed(unit: Unit): number {
  return effectiveAttrs(unit).speed
}

export function damageTakenFactor(unit: Unit, kind: DamageKind): number {
  if (kind === DamageKind.Fixed) return DEFAULT_DAMAGE_TAKEN
  let factor = DEFAULT_DAMAGE_TAKEN
  for (const status of unit.statuses) {
    factor *= kind === DamageKind.Physical ? status.damageTakenPhysical : status.damageTakenSpell
  }
  return factor
}

export function healTakenFactor(unit: Unit): number {
  let factor = DEFAULT_DAMAGE_TAKEN
  for (const status of unit.statuses) factor *= status.healTaken
  return factor
}

export function healDealtFactor(unit: Unit): number {
  let factor = DEFAULT_DAMAGE_TAKEN
  for (const status of unit.statuses) factor *= status.healDealt
  return factor
}
