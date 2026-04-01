import { Ability, AbilityConfig, AbilityFactory } from '../contracts/battle';
import { CreationAbilityBuilder } from './types';

export class BattleAbilityBuilder implements CreationAbilityBuilder {
  build(config: AbilityConfig): Ability {
    return AbilityFactory.create(config);
  }
}