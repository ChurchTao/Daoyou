/*
 * composers/types.ts: Composer 层接口定义。
 * ProductBlueprintComposer 是所有蓝图 Composer 的统一接口，便于通过 ProductComposerRegistry 路由。
 */
import { CreationSession } from '../CreationSession';
import { CreationBlueprint } from '../types';
export { buildAbilitySlug } from '../services/SlugService';

/**
 * 产物蓝图 Composer 接口
 * SkillBlueprintComposer / ArtifactBlueprintComposer / GongFaBlueprintComposer 均实现此接口
 */
export interface ProductBlueprintComposer {
  compose(session: CreationSession): CreationBlueprint;
}

