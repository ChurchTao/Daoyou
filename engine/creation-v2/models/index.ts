/*
 * models/index.ts: 领域模型导出。
 * 这里集中导出 CreationProductModel 及其各具体子类型，并提供 projectAbilityConfig 投影函数。
 */
export type {
  ActiveSkillBattleProjection,
  ArtifactDomainConfig,
  ArtifactProductModel,
  CreationProductModel,
  GongFaDomainConfig,
  GongFaProductModel,
  SkillProductModel,
} from './types';
export { projectAbilityConfig } from './AbilityProjection';