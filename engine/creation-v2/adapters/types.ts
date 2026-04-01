import type { Ability, AbilityConfig } from '../contracts/battle';
import { CraftedOutcome, CreationBlueprint, CreationProductType } from '../types';

export interface CreationAbilityBuilder {
  build(config: AbilityConfig): Ability;
}

export interface CreationOutcomeMaterializer {
  materialize(
    productType: CreationProductType,
    blueprint: CreationBlueprint,
  ): CraftedOutcome;
}