import { Ability, AbilityConfig, AbilityFactory } from '../contracts/battle';
import { CreationAbilityBuilder } from './types';

/*
 * BattleAbilityBuilder: CreationAbilityBuilder 的具体实现，调用战斗层的 AbilityFactory
 * 将 AbilityConfig 转换为 Ability 实例。
 */
export class BattleAbilityBuilder implements CreationAbilityBuilder {
  build(config: AbilityConfig): Ability {
    return AbilityFactory.create(config);
  }
}