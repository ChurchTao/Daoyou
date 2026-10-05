import { DamageKind, FormulaFamily, UnitKind } from '@daoyou/combat-core/enums';
import { type FormulaSet, type SchoolTerm, type SplashSpec, type StrikeFormulaInput, type Unit } from '@daoyou/combat-core/types';
import { DaoyouRule } from "@daoyou/game-content/combat/tuning"

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

/** 人物法攻放大后再减法防；法防达到放大后法攻的九成时，保底一成法攻。其他单位仍用法攻减法防。 */
function spellMargin(source: Unit, magicDef: number): number {
  const magicAtk = source.attrs.magicAtk
  if (source.kind !== UnitKind.Player) return magicAtk - magicDef
  const attack = Math.max(0, magicAtk) * DaoyouRule.playerSpellAttackScale
  if (attack <= 0) return 0
  if (magicDef >= attack * DaoyouRule.unbrokenDefRatio) return attack * DaoyouRule.unbrokenAtkRatio
  return Math.max(0, attack - magicDef)
}

function magicStrike(input: StrikeFormulaInput): number {
  const src = input.source.attrs
  const dst = input.target.attrs
  const term = schoolTermValue(input.schoolTerm, input.skillLevel ?? 0) + input.power
  const raw = spellMargin(input.source, dst.magicDef) + term
  const splashed = raw * splashFactor(input.splash, input.targetCount ?? 1)
  return finish(applyCultivate(splashed, src.spellCultivate - dst.resistSpellCultivate))
}

function magicStrikeV3(input: StrikeFormulaInput): number {
  const src = input.source.attrs
  const dst = input.target.attrs
  const schoolPower = schoolTermValue(input.schoolTerm, input.skillLevel ?? 0) + input.power
  const raw = (spellMargin(input.source, dst.magicDef) + schoolPower) * input.coeff
  return finish(applyCultivate(raw * splashFactor(input.splash, input.targetCount ?? 1), src.spellCultivate - dst.resistSpellCultivate))
}

const families: Record<string, (input: StrikeFormulaInput) => number> = {
  [FormulaFamily.GuardBreak]: (input) => {
    const attack = input.source.attrs.physicalAtk * (input.fury ? input.furyMultiplier ?? DaoyouRule.physicalFuryAtkMultiplier : 1)
    const factor = input.target.flags.defending ? input.coeff : 1
    const raw = physicalBase(attack, input.target.attrs.physicalDef) * factor + input.power
    return finish(applyCultivate(raw, input.source.attrs.attackCultivate - input.target.attrs.defenseCultivate))
  },
  [FormulaFamily.AttackDifference]: (input) => {
    const attack = input.source.attrs.physicalAtk * (input.fury ? input.furyMultiplier ?? DaoyouRule.physicalFuryAtkMultiplier : 1)
    const difference = attack - input.target.attrs.physicalAtk
    const cappedDifference = Math.min(difference, input.power)
    const raw = (attack - input.target.attrs.physicalDef + cappedDifference) * (difference > 0 ? 1.5 : 0.5) * input.coeff
    return finish(applyCultivate(raw, input.source.attrs.attackCultivate - input.target.attrs.defenseCultivate))
  },
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
  sealChanceCeil: DaoyouRule.sealChanceCeil,
  physicalBase,
  spellBase,
  baseDamage,
  physicalHitChance(source, target) {
    const delta = source.attrs.hit - target.attrs.dodge
    const scale = Math.max(
      DaoyouRule.hitChanceScale,
      Math.max(source.level, target.level) * DaoyouRule.physicalHitScalePerLevel,
    )
    return clamp(
      DaoyouRule.hitChanceFloor,
      DaoyouRule.hitChanceCeil,
      DaoyouRule.hitChanceBase +
        DaoyouRule.physicalHitBaselineGap / DaoyouRule.hitChanceScale +
        (delta - DaoyouRule.physicalHitBaselineGap) / scale,
    )
  },
  spellHitChance() {
    return 1
  },
  sealHitChance(source, target, skillLevel, sealBase, additiveChance = 0) {
    const level = skillLevel ?? source.level
    const basePercent = (sealBase ?? DaoyouRule.sealChanceBase * 100)
    const combatLevel = Math.max(source.level, target.level)
    const pointScale = Math.max(
      DaoyouRule.hitChanceScale,
      combatLevel * DaoyouRule.sealPointScalePerLevel,
    )
    const percent =
      basePercent +
      (level - target.level) * DaoyouRule.sealLevelWeight +
      DaoyouRule.sealCultivateWeight * Math.tanh(
        (source.attrs.spellCultivate - target.attrs.resistSpellCultivate) / DaoyouRule.sealCultivateScale,
      ) +
      ((source.attrs.sealHit - target.attrs.sealResist) / pointScale) * 100 +
      additiveChance * 100
    const floor = DaoyouRule.sealChanceFloor * 100
    const ceil = DaoyouRule.sealChanceCeil * 100
    if (percent < DaoyouRule.sealSoftFloorStart) {
      const span = DaoyouRule.sealSoftFloorStart - floor
      return (floor + span * Math.exp((percent - DaoyouRule.sealSoftFloorStart) / span)) / 100
    }
    if (percent > DaoyouRule.sealSoftCeilStart) {
      const span = ceil - DaoyouRule.sealSoftCeilStart
      return (DaoyouRule.sealSoftCeilStart + span * (1 - Math.exp(-(percent - DaoyouRule.sealSoftCeilStart) / span))) / 100
    }
    return percent / 100
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

export const daoyouFormulasV3: FormulaSet = {
  ...daoyouFormulas,
  baseDamage(input) {
    if (input.family === FormulaFamily.Spell || input.family === FormulaFamily.Dragon) {
      return magicStrikeV3(input)
    }
    return baseDamage(input)
  },
}
