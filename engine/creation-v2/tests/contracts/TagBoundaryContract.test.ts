import { describe, expect, it } from '@jest/globals';
import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import type { CreationProductType } from '@/engine/creation-v2/types';
import type { Material } from '@/types/cultivator';
import {
  CreationTags,
  isCreationTag,
  isRuntimeTag,
} from '@/engine/shared/tag-domain';

function makeOre(
  name: string,
  rank = '灵品' as Material['rank'],
  element: Material['element'] = undefined,
): Material {
  return {
    id: `test-${name}`,
    name,
    type: 'ore',
    rank,
    quantity: 2,
    element,
    description: '测试矿材',
  };
}

function makeHerb(name: string, rank = '灵品' as Material['rank']): Material {
  return {
    id: `test-${name}`,
    name,
    type: 'herb',
    rank,
    quantity: 2,
    element: '木',
    description: '测试灵草',
  };
}

function makeManual(
  name: string,
  rank = '灵品' as Material['rank'],
): Material {
  return {
    id: `test-${name}`,
    name,
    type: 'gongfa_manual',
    rank,
    quantity: 1,
    element: '金',
    description: '测试功法材料',
  };
}

function runFullPipeline(
  productType: CreationProductType,
  materials: Material[],
) {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId: `tag-boundary-${productType}`,
    productType,
    materials,
    ...(productType === 'artifact' ? { requestedSlot: 'weapon' as const } : {}),
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);

  if (session.state.intent) {
    if (productType === 'skill' && !session.state.intent.elementBias) {
      session.state.intent.elementBias = '火';
    }

    if (productType === 'artifact' && !session.state.intent.slotBias) {
      session.state.intent.slotBias = 'weapon';
    }
  }

  orchestrator.validateRecipeWithDefaults(session);
  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);

  if (
    session.state.affixPool.length > 0 &&
    !session.state.affixPool.some((affix) => affix.category === 'core')
  ) {
    session.state.affixPool[0].category = 'core';
  }

  orchestrator.rollAffixesWithDefaults(session);
  const blueprint = orchestrator.composeBlueprintWithDefaults(session);

  return { session, blueprint };
}

function expectCreationDomainTags(tags: string[]): void {
  expect(tags.length).toBeGreaterThan(0);

  tags.forEach((tag) => {
    expect(isCreationTag(tag)).toBe(true);
    expect(isRuntimeTag(tag)).toBe(false);
  });
}

function expectRuntimeDomainTags(tags: string[]): void {
  expect(tags.length).toBeGreaterThan(0);

  tags.forEach((tag) => {
    expect(isRuntimeTag(tag)).toBe(true);
    expect(isCreationTag(tag)).toBe(false);
  });
}

describe('Tag boundary contract', () => {
  it.each([
    {
      productType: 'skill' as const,
      materials: [makeOre('赤炎铁矿', '灵品', '火'), makeOre('锋铁')],
    },
    {
      productType: 'artifact' as const,
      materials: [makeOre('玄铁矿'), makeOre('锋铁矿')],
    },
    {
      productType: 'gongfa' as const,
      materials: [makeManual('悟道心法'), makeHerb('灵草')],
    },
  ])(
    '$productType 应保持 inputTags/outcomeTags/abilityTags 三层分离',
    ({ productType, materials }) => {
      const { session, blueprint } = runFullPipeline(productType, materials);

      expectCreationDomainTags(session.state.inputTags);
      expect(
        session.state.inputTags.some((tag) =>
          tag.startsWith(CreationTags.OUTCOME.ROOT),
        ),
      ).toBe(false);

      expectCreationDomainTags(blueprint.productModel.outcomeTags);
      expect(
        blueprint.productModel.outcomeTags.some((tag) =>
          tag.startsWith(CreationTags.OUTCOME.ROOT),
        ),
      ).toBe(true);

      expectRuntimeDomainTags(blueprint.productModel.battleProjection.abilityTags);
      expect(
        blueprint.productModel.battleProjection.abilityTags.some((tag) =>
          tag.startsWith(CreationTags.OUTCOME.ROOT),
        ),
      ).toBe(false);
    },
  );
});