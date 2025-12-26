/**
 * 战斗引擎模块统一导出
 */

// 类型定义
export type {
  BattleEngineResult,
  TurnSnapshot,
  TurnUnitSnapshot,
  InitialUnitState,
  DamageResult,
  DamageContext,
  CriticalContext,
  EvasionContext,
  AttributeContext,
} from './types';

// 常量
export {
  ELEMENT_WEAKNESS,
  CRITICAL_MULTIPLIER,
  MAX_EVASION_RATE,
  MIN_CRIT_RATE,
  MAX_CRIT_RATE,
  MAX_DAMAGE_REDUCTION,
} from './types';

// 计算器
export {
  AttributeCalculator,
  attributeCalculator,
  CriticalCalculator,
  criticalCalculator,
  DamageCalculator,
  damageCalculator,
  EvasionCalculator,
  evasionCalculator,
} from './calculators';

// 战斗单元
export { BattleUnit } from './BattleUnit';

// 技能执行器
export { SkillExecutor, skillExecutor } from './SkillExecutor';
export type { SkillExecutionResult } from './SkillExecutor';

// 战斗引擎 V2
export { BattleEngineV2, simulateBattle } from './BattleEngine.v2';
