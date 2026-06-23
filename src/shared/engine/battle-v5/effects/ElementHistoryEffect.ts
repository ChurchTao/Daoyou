import { ElementHistoryParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import {
  clearElementHistory,
  rememberElement,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { EffectContext, GameplayEffect } from './Effect';

const ABILITY_ELEMENT_TAGS = [
  GameplayTags.ABILITY.ELEMENT.FIRE,
  GameplayTags.ABILITY.ELEMENT.WATER,
  GameplayTags.ABILITY.ELEMENT.WOOD,
  GameplayTags.ABILITY.ELEMENT.EARTH,
  GameplayTags.ABILITY.ELEMENT.METAL,
  GameplayTags.ABILITY.ELEMENT.WIND,
  GameplayTags.ABILITY.ELEMENT.ICE,
  GameplayTags.ABILITY.ELEMENT.THUNDER,
] as const;

export class ElementHistoryEffect extends GameplayEffect {
  constructor(private params: ElementHistoryParams) {
    super();
  }

  execute(context: EffectContext): void {
    const eventAbility = (context.triggerEvent as { ability?: EffectContext['ability'] } | undefined)
      ?.ability;
    const ability = eventAbility ?? context.ability;
    const element = ABILITY_ELEMENT_TAGS.find((tag) => ability?.tags.hasTag(tag));
    if (!element) return;

    const count = rememberElement(context.caster, this.params.key, element);
    if (count < this.params.threshold) return;

    executeEffectConfigs(this.params.effects, context);
    if (this.params.resetOnTrigger !== false) {
      clearElementHistory(context.caster, this.params.key);
    }
  }
}

EffectRegistry.getInstance().register(
  'element_history',
  (params) => new ElementHistoryEffect(params),
);
