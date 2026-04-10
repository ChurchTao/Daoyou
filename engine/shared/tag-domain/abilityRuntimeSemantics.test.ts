import { describe, expect, it } from '@jest/globals';
import {
  ABILITY_CHANNEL_TO_TAG,
  ABILITY_FUNCTION_TO_TAG,
  ABILITY_KIND_TO_TAG,
  ABILITY_TARGET_TO_TAG,
  ABILITY_TRAIT_TO_TAG,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  projectAbilityRuntimeSemantics,
  validateAbilityRuntimeSemantics,
  isCreationTag,
  isRuntimeTag,
} from '@/engine/shared/tag-domain';

function expectUniqueAxis(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('abilityRuntimeSemantics schema', () => {
  it('各语义轴的运行时投影标签应在轴内唯一', () => {
    expectUniqueAxis(Object.values(ABILITY_FUNCTION_TO_TAG));
    expectUniqueAxis(Object.values(ABILITY_CHANNEL_TO_TAG));
    expectUniqueAxis(Object.values(ABILITY_KIND_TO_TAG));
    expectUniqueAxis(Object.values(ABILITY_TARGET_TO_TAG));
    expectUniqueAxis(Object.values(ABILITY_TRAIT_TO_TAG));
    expectUniqueAxis(Object.values(ELEMENT_TO_RUNTIME_ABILITY_TAG));
  });

  it('结构化语义投影出的标签应全部落在运行时域', () => {
    const tags = projectAbilityRuntimeSemantics({
      functions: ['damage', 'control'],
      channel: 'magic',
      kind: 'artifact',
      elements: ['火', '雷'],
      targets: ['aoe'],
      traits: ['execute', 'cooldown'],
    });

    expect(tags.length).toBeGreaterThan(0);
    tags.forEach((tag) => {
      expect(isRuntimeTag(tag)).toBe(true);
      expect(isCreationTag(tag)).toBe(false);
    });
  });

  it('validateAbilityRuntimeSemantics 应拒绝重复语义项', () => {
    expect(() =>
      validateAbilityRuntimeSemantics({
        functions: ['damage', 'damage'],
      }),
    ).toThrow('duplicate semantic entries are not allowed');
  });
});