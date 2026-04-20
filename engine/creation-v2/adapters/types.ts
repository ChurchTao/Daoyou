import type { Ability, AbilityConfig } from '../contracts/battle';
import { CraftedOutcome, CreationBlueprint, CreationProductType } from '../types';

/*
 * Adapter 接口定义：CreationAbilityBuilder / CreationOutcomeMaterializer
 *  - CreationAbilityBuilder: 将 Creation 中的 AbilityConfig 转换为 battle 层的 Ability 实例的工厂接口。
 *  - CreationOutcomeMaterializer: 将 CreationBlueprint 实体化为 CraftedOutcome（包含 blueprint 与 ability）
 */
export interface CreationAbilityBuilder {
  build(config: AbilityConfig): Ability;
}

export interface CreationOutcomeMaterializer {
  materialize(
    productType: CreationProductType,
    blueprint: CreationBlueprint,
  ): CraftedOutcome;
}