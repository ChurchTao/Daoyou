/*
 * AbilityProjection: 将领域层的 CreationProductModel 投影为战斗层的 AbilityConfig。
 * 责任：作为领域→战斗的单一转换边界，所有战斗相关字段（mpCost/cooldown/effects/listeners 等）
 * 都应从 CreationProductModel 的 battleProjection 字段中读取，保证投影逻辑集中可审计。
 */
import { AbilityConfig, AbilityType } from '../contracts/battle';
import { CreationProductModel } from './types';

export function projectAbilityConfig(
  model: CreationProductModel,
): AbilityConfig {
  switch (model.productType) {
    case 'skill':
      return {
        slug: model.slug,
        name: model.name,
        type: AbilityType.ACTIVE_SKILL,
        tags: model.battleProjection.abilityTags,
        mpCost: model.battleProjection.mpCost,
        cooldown: model.battleProjection.cooldown,
        priority: model.battleProjection.priority,
        targetPolicy: model.battleProjection.targetPolicy,
        effects: model.battleProjection.effects,
        ...(model.battleProjection.listeners
          ? { listeners: model.battleProjection.listeners }
          : {}),
      };

    case 'artifact':
    case 'gongfa':
      return {
        slug: model.slug,
        name: model.name,
        type: AbilityType.PASSIVE_SKILL,
        tags: model.battleProjection.abilityTags,
        listeners: model.battleProjection.listeners,
      };
  }
}