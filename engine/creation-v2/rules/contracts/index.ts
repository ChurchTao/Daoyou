/*
 * rules/contracts/index.ts: 导出 rules 层的所有 Facts/Decision 接口，作为不同规则集之间的契约。
 */
export type { AffixEligibilityFacts } from './AffixEligibilityFacts';
export type { AffixPoolDecision } from './AffixPoolDecision';
export type { AffixSelectionDecision } from './AffixSelectionDecision';
export type { AffixSelectionFacts } from './AffixSelectionFacts';
export type {
  CompositionDecision,
  CompositionProjectionKind,
  ProjectionPolicy,
  SkillProjectionPolicy,
  PassiveProjectionPolicy,
} from './CompositionDecision';
export type { CompositionFacts } from './CompositionFacts';
export type { MaterialDecision } from './MaterialDecision';
export type { MaterialFacts } from './MaterialFacts';
export type { RecipeDecision } from './RecipeDecision';
export type { RecipeFacts } from './RecipeFacts';