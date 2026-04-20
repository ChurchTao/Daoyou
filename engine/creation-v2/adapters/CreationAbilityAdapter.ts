import type { Ability } from '../contracts/battle';
import { projectAbilityConfig } from '../models';
import type { CraftedOutcome, CreationBlueprint, CreationProductType } from '../types';
import { BattleAbilityBuilder } from './BattleAbilityBuilder';
import { CreationAbilityBuilder, CreationOutcomeMaterializer } from './types';

type ActiveSkillAbility = Ability & { type: 'active_skill' };
type PassiveSkillAbility = Ability & { type: 'passive_skill' };

const OUTCOME_KIND_TO_ABILITY_TYPE = {
  active_skill: 'active_skill',
  artifact: 'passive_skill',
  gongfa: 'passive_skill',
} as const;

/*
 * CreationAbilityAdapter: 将 CreationBlueprint 实体化为 CraftedOutcome 的适配器。
 * 责任：校验 blueprint 形状、调用 BattleAbilityBuilder 将 abilityConfig 转换为战斗层 Ability 实例，
 * 返回 CraftedOutcome（包含 blueprint 与 ability 实例）。
 */
export class CreationAbilityAdapter implements CreationOutcomeMaterializer {
  constructor(
    private readonly abilityBuilder: CreationAbilityBuilder = new BattleAbilityBuilder(),
  ) {}

  materialize(
    _productType: CreationProductType,
    blueprint: CreationBlueprint,
  ): CraftedOutcome {
    this.assertBlueprintShape(blueprint);
    const abilityConfig = projectAbilityConfig(blueprint.productModel);
    const ability = this.abilityBuilder.build(abilityConfig);

    return {
      blueprint,
      ability,
    };
  }

  private assertBlueprintShape(
    blueprint: CreationBlueprint,
  ): void {
    const expectedType = OUTCOME_KIND_TO_ABILITY_TYPE[blueprint.outcomeKind];
    const projectedAbilityType = projectAbilityConfig(blueprint.productModel).type;

    if (projectedAbilityType !== expectedType) {
      throw new Error(
        `Blueprint outcome kind ${blueprint.outcomeKind} does not match projected ability type ${projectedAbilityType}`,
      );
    }
  }

  isActiveSkill(ability: Ability): ability is ActiveSkillAbility {
    return ability.type === OUTCOME_KIND_TO_ABILITY_TYPE.active_skill;
  }

  isPassiveAbility(ability: Ability): ability is PassiveSkillAbility {
    return ability.type === OUTCOME_KIND_TO_ABILITY_TYPE.artifact;
  }
}
