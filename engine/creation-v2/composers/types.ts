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

