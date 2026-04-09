import { checkConditions, evaluateCondition } from '@/engine/battle-v5/core/conditionEvaluator';
import { GameplayTagContainer, GameplayTags } from '@/engine/battle-v5/core/GameplayTags';
import type { ConditionConfig } from '@/engine/battle-v5/core/configs';
import { DamageType } from '@/engine/battle-v5/core/types';

function createTagContainer(tags: string[]): GameplayTagContainer {
  const container = new GameplayTagContainer();
  container.addTags(tags);
  return container;
}

function createUnitStub(tags: string[] = []) {
  const tagContainer = createTagContainer(tags);
  return {
    tags: tagContainer,
    getCurrentHp: () => 80,
    getMaxHp: () => 100,
    getCurrentMp: () => 40,
    getMaxMp: () => 100,
  };
}

function createAbilityStub(tags: string[] = []) {
  return {
    tags: createTagContainer(tags),
  };
}

describe('conditionEvaluator', () => {
  it('has_tag 应尊重 scope=caster', () => {
    const condition: ConditionConfig = {
      type: 'has_tag',
      params: {
        tag: 'Status.Chill',
        scope: 'caster',
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(['Status.Chill']),
        target: createUnitStub(),
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('has_not_tag 应尊重 scope=caster', () => {
    const condition: ConditionConfig = {
      type: 'has_not_tag',
      params: {
        tag: 'Status.Burn',
        scope: 'caster',
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(['Status.Burn']),
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('ability_has_tag 应支持直接读取 context.ability.tags', () => {
    const condition: ConditionConfig = {
      type: 'ability_has_tag',
      params: {
        tag: GameplayTags.ABILITY.ELEMENT_FIRE,
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
        ability: createAbilityStub([GameplayTags.ABILITY.ELEMENT_FIRE]),
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('ability_has_tag 应支持从 triggerEvent.ability 回退读取标签', () => {
    const condition: ConditionConfig = {
      type: 'ability_has_tag',
      params: {
        tag: GameplayTags.ABILITY.ELEMENT_THUNDER,
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
        triggerEvent: {
          type: 'DamageRequestEvent',
          ability: createAbilityStub([GameplayTags.ABILITY.ELEMENT_THUNDER]),
        },
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('ability_has_tag 在 context.ability 与 triggerEvent.ability 同时存在时应优先读取触发技能标签', () => {
    const condition: ConditionConfig = {
      type: 'ability_has_tag',
      params: {
        tag: GameplayTags.ABILITY.ELEMENT_FIRE,
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
        ability: createAbilityStub([GameplayTags.ABILITY.ELEMENT_WATER]),
        triggerEvent: {
          type: 'DamageRequestEvent',
          ability: createAbilityStub([GameplayTags.ABILITY.ELEMENT_FIRE]),
        },
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('ability_has_not_tag 在 ability 缺失时应视为满足', () => {
    const condition: ConditionConfig = {
      type: 'ability_has_not_tag',
      params: {
        tag: GameplayTags.ABILITY.ELEMENT_ICE,
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('damage_type_is 应继续从触发事件读取伤害类型', () => {
    const condition: ConditionConfig = {
      type: 'damage_type_is',
      params: {
        damageType: DamageType.MAGICAL,
      },
    };

    const result = evaluateCondition(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
        triggerEvent: {
          type: 'DamageRequestEvent',
          damageType: DamageType.MAGICAL,
        },
      },
      condition,
    );

    expect(result).toBe(true);
  });

  it('checkConditions 应以 AND 语义组合 ability 标签与伤害类型条件', () => {
    const conditions: ConditionConfig[] = [
      {
        type: 'ability_has_tag',
        params: {
          tag: GameplayTags.ABILITY.ELEMENT_FIRE,
        },
      },
      {
        type: 'damage_type_is',
        params: {
          damageType: DamageType.MAGICAL,
        },
      },
    ];

    const result = checkConditions(
      {
        caster: createUnitStub(),
        target: createUnitStub(),
        ability: createAbilityStub([
          GameplayTags.ABILITY.ELEMENT_FIRE,
          GameplayTags.ABILITY.TYPE_MAGIC,
        ]),
        triggerEvent: {
          type: 'DamageRequestEvent',
          damageType: DamageType.MAGICAL,
        },
      },
      conditions,
    );

    expect(result).toBe(true);
  });
});