export type CultivationExpRounding = 'floor' | 'ceil' | 'round';

export interface CultivationExpCalculationInput {
  /** 参与旧公式的经验上限。旧公式：cap × percent × units。 */
  cap: number;
  /** 参与旧公式的 cap 百分比，例如 0.01 表示 1% cap。 */
  percent: number;
  /** 旧公式的重复单位，默认 1。 */
  units?: number;
  /** 原始收益取整方式，默认 floor。 */
  rounding?: CultivationExpRounding;
  /** 当 rawExp > 0 时的最低最终收益。 */
  minBaseExp?: number;
  /** 最终收益上限。 */
  maxBaseExp?: number;
}

export interface DailyBudgetExpCalculationInput {
  /** 当前境界的每日经验预算。 */
  dailyBudget: number;
  /** 本玩法占每日预算的比例，例如 0.25 表示 25% 日预算。 */
  sourceDailyFraction: number;
  /** 玩法单位数，例如离线 24 小时 = 4 个 6 小时单位。 */
  units?: number;
  /** 玩法附加倍率，例如随机波动、评级、风险等。 */
  sourceMultiplier?: number;
  /** 原始收益取整方式，默认 floor。 */
  rounding?: CultivationExpRounding;
  /** 当 rawExp > 0 时的最低最终收益。 */
  minBaseExp?: number;
  /** 最终收益上限。 */
  maxBaseExp?: number;
}

export interface CultivationExpCalculationTrace {
  cap?: number;
  percent?: number;
  dailyBudget?: number;
  sourceDailyFraction?: number;
  sourceMultiplier?: number;
  units: number;
  rawExp: number;
  roundedExp: number;
  rounding: CultivationExpRounding;
  minBaseExp?: number;
  maxBaseExp?: number;
}

export interface CultivationExpCalculation {
  baseExp: number;
  rawExp: number;
  trace: CultivationExpCalculationTrace;
}

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`修为收益计算参数 ${name} 必须是有限数字: ${value}`);
  }
}

function finalizeExpCalculation(args: {
  rawExp: number;
  rounding: CultivationExpRounding;
  minBaseExp?: number;
  maxBaseExp?: number;
  trace: Omit<
    CultivationExpCalculationTrace,
    'rawExp' | 'roundedExp' | 'rounding' | 'minBaseExp' | 'maxBaseExp'
  >;
}): CultivationExpCalculation {
  const roundedExp = roundExp(args.rawExp, args.rounding);

  let baseExp = roundedExp;
  if (args.rawExp > 0 && args.minBaseExp !== undefined) {
    baseExp = Math.max(baseExp, args.minBaseExp);
  }
  if (args.maxBaseExp !== undefined) {
    baseExp = Math.min(baseExp, args.maxBaseExp);
  }

  return {
    baseExp: Math.max(0, Math.floor(baseExp)),
    rawExp: args.rawExp,
    trace: {
      ...args.trace,
      rawExp: args.rawExp,
      roundedExp,
      rounding: args.rounding,
      minBaseExp: args.minBaseExp,
      maxBaseExp: args.maxBaseExp,
    },
  };
}

function roundExp(value: number, rounding: CultivationExpRounding): number {
  switch (rounding) {
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      return Math.round(value);
    case 'floor':
      return Math.floor(value);
  }
}

/**
 * 纯修为收益计算核心。
 *
 * 只负责 cap × percent × units 的数学计算，不认识场景、境界、品质、
 * 评级、危险度、命格或任何业务倍率。
 *
 * 当前仅用于丹药兼容和低层测试；普通玩法应使用
 * calculateCultivationExpByDailyBudget。
 */
export function calculateCultivationExpByCap(
  input: CultivationExpCalculationInput,
): CultivationExpCalculation {
  const units = input.units ?? 1;
  const rounding = input.rounding ?? 'floor';

  assertFiniteNumber('cap', input.cap);
  assertFiniteNumber('percent', input.percent);
  assertFiniteNumber('units', units);

  if (input.minBaseExp !== undefined) {
    assertFiniteNumber('minBaseExp', input.minBaseExp);
  }
  if (input.maxBaseExp !== undefined) {
    assertFiniteNumber('maxBaseExp', input.maxBaseExp);
  }

  const safeCap = Math.max(0, input.cap);
  const safePercent = Math.max(0, input.percent);
  const safeUnits = Math.max(0, units);
  const rawExp = safeCap * safePercent * safeUnits;

  return finalizeExpCalculation({
    rawExp,
    rounding,
    minBaseExp: input.minBaseExp,
    maxBaseExp: input.maxBaseExp,
    trace: {
      cap: safeCap,
      percent: safePercent,
      units: safeUnits,
    },
  });
}

/**
 * 每日预算驱动的修为收益计算核心。
 *
 * 公式：
 *   baseExp = floor(
 *     dailyBudget
 *     × sourceDailyFraction
 *     × units
 *     × sourceMultiplier
 *   )
 *
 * 普通玩法只由该公式决定收益；当前阶段 exp_cap 只负责进度上限与突破判断。
 */
export function calculateCultivationExpByDailyBudget(
  input: DailyBudgetExpCalculationInput,
): CultivationExpCalculation {
  const units = input.units ?? 1;
  const sourceMultiplier = input.sourceMultiplier ?? 1;
  const rounding = input.rounding ?? 'floor';

  assertFiniteNumber('dailyBudget', input.dailyBudget);
  assertFiniteNumber('sourceDailyFraction', input.sourceDailyFraction);
  assertFiniteNumber('units', units);
  assertFiniteNumber('sourceMultiplier', sourceMultiplier);

  if (input.minBaseExp !== undefined) {
    assertFiniteNumber('minBaseExp', input.minBaseExp);
  }
  if (input.maxBaseExp !== undefined) {
    assertFiniteNumber('maxBaseExp', input.maxBaseExp);
  }

  const safeDailyBudget = Math.max(0, input.dailyBudget);
  const safeSourceDailyFraction = Math.max(0, input.sourceDailyFraction);
  const safeUnits = Math.max(0, units);
  const safeSourceMultiplier = Math.max(0, sourceMultiplier);
  const rawExp =
    safeDailyBudget *
    safeSourceDailyFraction *
    safeUnits *
    safeSourceMultiplier;

  return finalizeExpCalculation({
    rawExp,
    rounding,
    minBaseExp: input.minBaseExp,
    maxBaseExp: input.maxBaseExp,
    trace: {
      dailyBudget: safeDailyBudget,
      sourceDailyFraction: safeSourceDailyFraction,
      sourceMultiplier: safeSourceMultiplier,
      units: safeUnits,
    },
  });
}
