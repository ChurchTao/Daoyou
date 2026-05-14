import { describe, expect, it } from 'vitest';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BASIC_SKILLS, BASIC_TECHNIQUES } from './config';

describe('starter products', () => {
  it('all starter techniques should expose affixes and valid passive abilities', () => {
    for (const buildTechnique of Object.values(BASIC_TECHNIQUES)) {
      const technique = buildTechnique();
      expect(technique.productModel).toBeDefined();
      expect((technique.productModel as { affixes?: unknown[] }).affixes?.length).toBeGreaterThan(0);
      expect(technique.abilityConfig).toBeDefined();
      expect(() => AbilityFactory.create(technique.abilityConfig!)).not.toThrow();
    }
  });

  it('all starter skills should expose affixes and valid active abilities', () => {
    for (const skills of Object.values(BASIC_SKILLS)) {
      for (const skill of skills) {
        expect(skill.productModel).toBeDefined();
        expect((skill.productModel as { affixes?: unknown[] }).affixes?.length).toBeGreaterThan(0);
        expect(skill.abilityConfig).toBeDefined();
        expect(() => AbilityFactory.create(skill.abilityConfig!)).not.toThrow();
      }
    }
  });
});
