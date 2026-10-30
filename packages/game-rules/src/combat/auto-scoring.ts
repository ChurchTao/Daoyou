import { DamageOrigin, FormulaFamily, UnitKind } from '@daoyou/combat-core/enums';
import type { DamageOrigin as DamageOriginType } from '@daoyou/combat-core/enums';
import type { SchoolTerm, SplashSpec, Unit } from '@daoyou/combat-core/types';
import { DaoyouRule } from '@daoyou/game-content/combat/tuning';
import { applyCultivate, schoolTermValue, splashFactor } from './daoyou/formulas.js';
import { cultivationModifiers } from './daoyou/cultivation.js';

/** 公开气血比例低于此值时，给自动估分一小段收尾加分。 */
export const ENEMY_EXECUTE_HP_RATIO = 0.2;
export const ENEMY_EXECUTE_BONUS = 8;

const PUBLIC_FACTS = new Set(['isCharacter', 'isBeast']);

/** 表达式是否读取了敌方不可见面板。人物／灵兽类别仍算公开。 */
export function expressionReadsHiddenTarget(expression: string): boolean {
  if (
    expression.includes('targetEffective.') ||
    expression.includes('targetDefending') ||
    expression.includes('targetKnown.')
  )
    return true;
  return [...expression.matchAll(/targetFact\.([A-Za-z0-9_]+)/g)].some(
    (match) => !PUBLIC_FACTS.has(match[1] ?? ''),
  );
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function finish(raw: number): number {
  return Math.max(DaoyouRule.minDamage, Math.floor(raw));
}

function ownPhysical(source: Unit, coeff: number, power: number): number {
  const atk = source.attrs.physicalAtk;
  const base =
    atk <= 0
      ? DaoyouRule.minDamage
      : Math.max(DaoyouRule.minDamage, atk * DaoyouRule.physicalCoefficient);
  return finish(
    applyCultivate(base * coeff + power, source.attrs.attackCultivate),
  );
}

/** 人物保留自己的法攻放大。对方法防、抗性修为不进入估分。系数与现行 V6 法术族一致。 */
function ownSpell(
  source: Unit,
  power: number,
  skillLevel: number,
  schoolTerm: SchoolTerm | undefined,
  splash: SplashSpec | undefined,
  targetCount: number,
  coeff: number,
): number {
  const magicAtk = source.attrs.magicAtk;
  const margin =
    source.kind === UnitKind.Player
      ? Math.max(0, magicAtk) * DaoyouRule.playerSpellAttackScale
      : magicAtk;
  const splashed =
    (margin + schoolTermValue(schoolTerm, skillLevel) + power) *
    splashFactor(splash, targetCount);
  return finish(
    applyCultivate(splashed * coeff, source.attrs.spellCultivate),
  );
}

/**
 * 对敌伤害只保留施法者自己的输出。
 * 对方防御、对方攻击、破防分支、攻差倍数都不产生评分差。
 */
export function visibleOutgoingDamage(input: {
  percentageDamage?: boolean;
  origin?: DamageOriginType;
  source: Unit;
  family: string;
  coeff: number;
  power: number;
  skillLevel: number;
  schoolTerm?: SchoolTerm;
  splash?: SplashSpec;
  targetCount: number;
}): number {
  const { source, family, coeff, power, skillLevel, schoolTerm, splash, targetCount } = input;
  if (family === FormulaFamily.Judge)
    return finish(power);
  if (family === FormulaFamily.Fixed)
    return finish(input.percentageDamage || (input.origin ?? DamageOrigin.ActionDirect) !== DamageOrigin.ActionDirect
      ? power
      : applyCultivate(power, source.attrs.spellCultivate));
  if (family === FormulaFamily.AttackDifference) {
    return finish(
      applyCultivate(source.attrs.physicalAtk * coeff, source.attrs.attackCultivate),
    );
  }
  if (family === FormulaFamily.GuardBreak) return ownPhysical(source, 1, power);
  if (family === FormulaFamily.Spell || family === FormulaFamily.Dragon)
    return ownSpell(source, power, skillLevel, schoolTerm, splash, targetCount, coeff);
  return ownPhysical(source, coeff, power);
}

/** 命中只保留自己的命中和双方可见等级，不减对方闪避。 */
export function visiblePhysicalHitChance(source: Unit, targetLevel: number): number {
  const scale = Math.max(
    DaoyouRule.hitChanceScale,
    Math.max(source.level, targetLevel) * DaoyouRule.physicalHitScalePerLevel,
  );
  return clamp(
    DaoyouRule.hitChanceFloor,
    DaoyouRule.hitChanceCeil,
    DaoyouRule.hitChanceBase +
      DaoyouRule.physicalHitBaselineGap / DaoyouRule.hitChanceScale +
      (source.attrs.hit - DaoyouRule.physicalHitBaselineGap) / scale,
  );
}

/** 封印只保留自己的命中、修为和双方可见等级，不减对方抵抗。 */
export function visibleSealHitChance(
  source: Unit,
  targetLevel: number,
  skillLevel: number | undefined,
  sealBase: number | undefined,
  additiveChance = 0,
  ceiling: number = DaoyouRule.sealChanceCeil,
): number {
  const level = skillLevel ?? source.level;
  const basePercent = sealBase ?? DaoyouRule.sealChanceBase * 100;
  const combatLevel = Math.max(source.level, targetLevel);
  const pointScale = Math.max(
    DaoyouRule.hitChanceScale,
    combatLevel * DaoyouRule.sealPointScalePerLevel,
  );
  const percent =
    basePercent +
    (level - targetLevel) * DaoyouRule.sealLevelWeight +
    cultivationModifiers(source.attrs.spellCultivate).sealPercent +
    (source.attrs.sealHit / pointScale) * 100 +
    additiveChance * 100;
  const floor = DaoyouRule.sealChanceFloor * 100;
  const ceil = clamp(DaoyouRule.sealChanceFloor, 1, ceiling) * 100;
  if (percent < DaoyouRule.sealSoftFloorStart) {
    const span = DaoyouRule.sealSoftFloorStart - floor;
    return (
      Math.min(ceil, floor + span * Math.exp((percent - DaoyouRule.sealSoftFloorStart) / span)) /
      100
    );
  }
  const softCeilStart = Math.min(DaoyouRule.sealSoftCeilStart, ceil);
  if (percent > softCeilStart) {
    const span = ceil - softCeilStart;
    if (span === 0) return ceil / 100;
    return (
      (softCeilStart +
        span * (1 - Math.exp(-(percent - softCeilStart) / span))) /
      100
    );
  }
  return percent / 100;
}
