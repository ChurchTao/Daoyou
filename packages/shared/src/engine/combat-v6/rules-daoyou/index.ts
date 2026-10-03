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
    protectionTargetRatio: 0.3,
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

/** Current runtime rules; configurable base rules above support pure formula checks. */
export const daoyouRulesetV6: Ruleset = {
  ...createDaoyouRuleset({ formulas: daoyouFormulasV3, maxRounds: 100 }),
  name: 'daoyou-rules-v6',
  deferredPlayerCommands: true,
}
