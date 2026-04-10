/*
 * engine/creation-v2 导出入口：对外暴露造物系统的主要构件（Orchestrator、Session、分析/规则/Composer/Adapter 等）。
 * 目的：提供一个清晰的公共 API 以便服务层或测试套件直接引用造物系统的能力。
 */
export { CreationOrchestrator } from './CreationOrchestrator';
export { CreationSession } from './CreationSession';
export { BattleAbilityBuilder } from './adapters/BattleAbilityBuilder';
export { CreationAbilityAdapter } from './adapters/CreationAbilityAdapter';
export type {
	CreationAbilityBuilder,
	CreationOutcomeMaterializer,
} from './adapters/types';
export { DefaultMaterialAnalyzer } from './analysis/DefaultMaterialAnalyzer';
export { MaterialTagNormalizer } from './analysis/MaterialTagNormalizer';
export { DefaultEnergyBudgeter } from './budgeting/DefaultEnergyBudgeter';
export {
	ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
	DEFAULT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
	CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES,
	GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE,
	SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE,
	resolveAffixSelectionConstraints,
} from './config/AffixSelectionConstraints';
export type { AffixSelectionConstraintProfile } from './config/AffixSelectionConstraints';
export { CreationEventBus } from './core/EventBus';
export { CreationTagContainer, CreationTags } from './core/GameplayTags';
export { CreationPhaseHandlerRegistry } from './handlers/CreationPhaseHandlers';
export type { CreationPhaseHandlerDeps } from './handlers/CreationPhaseHandlers';
export * from './core/events';
export * from './core/types';
export { DefaultIntentResolver } from './resolvers/DefaultIntentResolver';
export { DefaultRecipeValidator } from './rules/DefaultRecipeValidator';
export * from './rules/ruleExports';
export { RuleDiagnostics, RuleSet } from './rules/core';
export type {
	Rule,
	RuleContext,
	RuleContextMetadata,
	RuleDecisionMeta,
	RuleDiagnosticsSnapshot,
	RuleReason,
	RuleTraceEntry,
	RuleTraceOutcome,
} from './rules/core';
export type {
	AffixEligibilityFacts,
	AffixPoolDecision,
	AffixSelectionDecision,
	AffixSelectionConstraints,
	AffixSelectionFacts,
	CompositionDecision,
	CompositionEnergySummary,
	CompositionFacts,
	MaterialDecision,
	MaterialFacts,
	RecipeDecision,
	RecipeFacts,
} from './rules/contracts';
export * from './types';
export * from './errors';