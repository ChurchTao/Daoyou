import {
  DamageKind,
  FormulaFamily,
  type FormulaSet,
  type SchoolTerm,
  type SplashSpec,
  type StrikeFormulaInput,
  type Unit,
} from "../core/index.ts"
import { DaoyouRule } from "./constants.ts"

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function finish(raw: number): number {
  return Math.max(DaoyouRule.minDamage, Math.floor(raw))
}

export function schoolTermValue(term: SchoolTerm | undefined, skillLevel: number): number {
  if (!term) return 0
  const n = skillLevel
  return (term.quad ?? 0) * n * n + (term.linear ?? 0) * n + (term.intercept ?? 0)
}

export function splashFactor(splash: SplashSpec | undefined, targetCount: number): number {
  if (!splash) return 1
  return Math.max(splash.floor, 1 - targetCount * splash.perTarget)
}

export function applyCultivate(base: number, diff: number): number {
  const effectiveDiff = clamp(
    DaoyouRule.damageCultivateDiffMin,
    DaoyouRule.damageCultivateDiffMax,
    diff,
  )
  return base * (1 + effectiveDiff * DaoyouRule.cultivateRate) + effectiveDiff * DaoyouRule.cultivateFlat
}

export function physicalBase(atk: number, def: number): number {
  if (atk <= 0) return DaoyouRule.minDamage
  const raw =
    def >= atk * DaoyouRule.unbrokenDefRatio
      ? atk * DaoyouRule.unbrokenAtkRatio
      : Math.max(0, atk - def)
  return Math.max(DaoyouRule.minDamage, raw * DaoyouRule.physicalCoefficient)
}

export function spellBase(magicAtk: number, magicDef: number, power: number): number {
  return Math.max(DaoyouRule.minDamage, magicAtk - magicDef + power)
}

function magicStrike(input: StrikeFormulaInput): number {
  const src = input.source.attrs
  const dst = input.target.attrs
  const term = schoolTermValue(input.schoolTerm, input.skillLevel ?? 0) + input.power
  const raw = src.magicAtk - dst.magicDef + term
  const splashed = raw * splashFactor(input.splash, input.targetCount ?? 1)
  return finish(applyCultivate(splashed, src.spellCultivate - dst.resistSpellCultivate))
}

const families: Record<string, (input: StrikeFormulaInput) => number> = {
  [FormulaFamily.Physical]: (input) => {
    const furyMultiplier = input.fury
      ? (input.furyMultiplier ?? DaoyouRule.physicalFuryAtkMultiplier)
      : 1
    const attack = input.source.attrs.physicalAtk * furyMultiplier
    const raw = physicalBase(attack, input.target.attrs.physicalDef) * input.coeff + input.power
    return finish(
      applyCultivate(
        raw,
        input.source.attrs.attackCultivate - input.target.attrs.defenseCultivate,
      ),
    )
  },
  [FormulaFamily.Spell]: magicStrike,
  [FormulaFamily.Dragon]: magicStrike,
  [FormulaFamily.Judge]: (input) => finish(input.power),
  [FormulaFamily.Fixed]: (input) => finish(input.power),
}

export function baseDamage(input: StrikeFormulaInput): number {
  const compute = families[input.family]
  if (compute) return compute(input)
  return families[
    input.kind === DamageKind.Physical ? FormulaFamily.Physical : FormulaFamily.Spell
  ](input)
}

export const daoyouFormulas: FormulaSet = {
  fluctuationMin: DaoyouRule.spellFluctuationMin,
  fluctuationMax: DaoyouRule.spellFluctuationMax,
  physicalFluctuationMin: DaoyouRule.physicalFluctuationMin,
  physicalFluctuationMax: DaoyouRule.physicalFluctuationMax,
  critMultiplier: DaoyouRule.critMultiplier,
  furyAtkMultiplier: DaoyouRule.physicalFuryAtkMultiplier,
  defendPhysicalFactor: DaoyouRule.defendPhysicalFactor,
  physicalBase,
  spellBase,
  baseDamage,
  physicalHitChance(source, target) {
    const delta = source.attrs.hit - target.attrs.dodge
    return clamp(
      DaoyouRule.hitChanceFloor,
      DaoyouRule.hitChanceCeil,
      DaoyouRule.hitChanceBase + delta / DaoyouRule.hitChanceScale,
    )
  },
  spellHitChance() {
    return 1
  },
  sealHitChance(source, target, skillLevel, sealBase) {
    const level = skillLevel ?? source.level
    const basePercent = (sealBase ?? DaoyouRule.sealChanceBase * 100)
    const cultivateDiff = clamp(
      DaoyouRule.sealCultivateDiffMin,
      DaoyouRule.sealCultivateDiffMax,
      source.attrs.spellCultivate - target.attrs.resistSpellCultivate,
    )
    const percent =
      basePercent +
      (level - target.level) * DaoyouRule.sealLevelWeight +
      cultivateDiff * DaoyouRule.sealCultivateWeight +
      ((source.attrs.sealHit - target.attrs.sealResist) / DaoyouRule.hitChanceScale) * 100
    return clamp(DaoyouRule.sealChanceFloor, DaoyouRule.sealChanceCeil, percent / 100)
  },
  fleeChance(unit, enemies) {
    const averageEnemySpeed =
      enemies.length === 0
        ? 0
        : enemies.reduce((sum: number, enemy: Unit) => sum + enemy.attrs.speed, 0) /
          enemies.length
    return clamp(
      DaoyouRule.fleeChanceFloor,
      DaoyouRule.fleeChanceCeil,
      DaoyouRule.fleeChanceBase +
        (unit.attrs.speed - averageEnemySpeed) / DaoyouRule.hitChanceScale,
    )
  },
}
