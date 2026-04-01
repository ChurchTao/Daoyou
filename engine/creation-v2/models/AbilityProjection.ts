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