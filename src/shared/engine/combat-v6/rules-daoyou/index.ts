import {
  CommandType,
  HpZeroOutcome,
  UnitKind,
  type FormulaSet,
  type Ruleset,
} from "../core/index.ts"
import { DaoyouRule } from "./constants.ts"
import {
  applyCultivate,
  baseDamage,
  daoyouFormulas,
  daoyouFormulasV3,
  physicalBase,
  schoolTermValue,
  spellBase,
  splashFactor,
} from "./formulas.ts"

export {
  applyCultivate,
  baseDamage,
  DaoyouRule,
  daoyouFormulas,
  daoyouFormulasV3,
  physicalBase,
  schoolTermValue,
  spellBase,
  splashFactor,
}

export type DaoyouRulesetOptions = {
  formulas?: Partial<FormulaSet>
  maxRounds?: number
}

export function createDaoyouRuleset(options: DaoyouRulesetOptions = {}): Ruleset {
  const overlay = options.formulas ?? {}
  const formulas: FormulaSet = { ...daoyouFormulas, ...overlay }
  if (overlay.fluctuationMin !== undefined && overlay.physicalFluctuationMin === undefined) {
    formulas.physicalFluctuationMin = overlay.fluctuationMin
  }
  if (overlay.fluctuationMax !== undefined && overlay.physicalFluctuationMax === undefined) {
    formulas.physicalFluctuationMax = overlay.fluctuationMax
  }
  return {
    name: "daoyou-rules-v1",
    maxRounds: options.maxRounds ?? DaoyouRule.maxRounds,
    formulas,
    hpZeroOutcome(unit) {
      return unit.kind === UnitKind.Player ? HpZeroOutcome.Downed : HpZeroOutcome.Dead
    },
    decideCommand({ unit, enemies }) {
      if (unit.flags.auto && unit.lastCommand && unit.lastCommand.type !== CommandType.Auto) {
        return unit.lastCommand
      }
      const target = enemies[0]
      return target
        ? { type: CommandType.Attack, target: target.id }
        : { type: CommandType.Defend }
    },
  }
}

export const daoyouDeterministicRuleset = createDaoyouRuleset({
  formulas: { fluctuationMin: 1, fluctuationMax: 1 },
})

export const daoyouRuleset = createDaoyouRuleset()

export function createDaoyouRulesetV2(options: DaoyouRulesetOptions = {}): Ruleset {
  return { ...createDaoyouRuleset(options), name: "daoyou-rules-v2" }
}

export const daoyouDeterministicRulesetV2 = createDaoyouRulesetV2({
  formulas: { fluctuationMin: 1, fluctuationMax: 1 },
})

export const daoyouRulesetV2 = createDaoyouRulesetV2()

export function createDaoyouRulesetV3(options: DaoyouRulesetOptions = {}): Ruleset {
  const rules = createDaoyouRuleset({
    ...options,
    formulas: { ...daoyouFormulasV3, ...(options.formulas ?? {}) },
  })
  return { ...rules, name: "daoyou-rules-v3" }
}

export const daoyouDeterministicRulesetV3 = createDaoyouRulesetV3({
  formulas: { fluctuationMin: 1, fluctuationMax: 1 },
})

export const daoyouRulesetV3 = createDaoyouRulesetV3()

export function createDaoyouRulesetV4(options: DaoyouRulesetOptions = {}): Ruleset {
  return { ...createDaoyouRulesetV3(options), name: "daoyou-rules-v4" }
}

export const daoyouDeterministicRulesetV4 = createDaoyouRulesetV4({
  formulas: { fluctuationMin: 1, fluctuationMax: 1 },
})

export const daoyouRulesetV4 = createDaoyouRulesetV4()

export function createDaoyouRulesetV5(options: DaoyouRulesetOptions = {}): Ruleset {
  return { ...createDaoyouRulesetV4(options), name: "daoyou-rules-v5" }
}

export const daoyouDeterministicRulesetV5 = createDaoyouRulesetV5({
  formulas: { fluctuationMin: 1, fluctuationMax: 1 },
})

export const daoyouRulesetV5 = createDaoyouRulesetV5()
