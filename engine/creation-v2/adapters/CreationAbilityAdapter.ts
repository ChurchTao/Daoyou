import type { Ability } from '../contracts/battle';
import { projectAbilityConfig } from '../models';
import { CraftedOutcome, CreationBlueprint, CreationProductType } from '../types';
import { BattleAbilityBuilder } from './BattleAbilityBuilder';
import { CreationAbilityBuilder, CreationOutcomeMaterializer } from './types';

type ActiveSkillAbility = Ability & { type: 'active_skill' };
type PassiveSkillAbility = Ability & { type: 'passive_skill' };

const OUTCOME_KIND_TO_ABILITY_TYPE = {
  active_skill: 'active_skill',
  artifact: 'passive_skill',
  gongfa: 'passive_skill',
} as const;

export class CreationAbilityAdapter implements CreationOutcomeMaterializer {
  constructor(
    private readonly abilityBuilder: CreationAbilityBuilder = new BattleAbilityBuilder(),
  ) {}

  materialize(
    productType: CreationProductType,
    blueprint: CreationBlueprint,
  ): CraftedOutcome {
    const abilityConfig = projectAbilityConfig(blueprint.productModel);
    this.assertBlueprintShape(blueprint, abilityConfig.type);
    const ability = this.abilityBuilder.build(abilityConfig);

    return {
      productType,
      outcomeKind: blueprint.outcomeKind,
      blueprint,
      productModel: blueprint.productModel,
      abilityConfig,
      ability,
    };
  }

  private assertBlueprintShape(
    blueprint: CreationBlueprint,
    projectedAbilityType: string,
  ): void {
    const expectedType = OUTCOME_KIND_TO_ABILITY_TYPE[blueprint.outcomeKind];

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