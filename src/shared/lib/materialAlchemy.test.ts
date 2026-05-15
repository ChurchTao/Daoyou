import { ELEMENT_VALUES, QUALITY_VALUES } from '@shared/types/constants';
import { buildMaterialAlchemyProfile } from './materialAlchemy';

describe('buildMaterialAlchemyProfile', () => {
  it('builds valid profiles for every alchemy material type, quality, and element', () => {
    const materialTypes = ['herb', 'ore', 'monster', 'tcdb', 'aux'] as const;

    for (const type of materialTypes) {
      for (const quality of QUALITY_VALUES) {
        for (const element of ELEMENT_VALUES) {
          const profile = buildMaterialAlchemyProfile(type, quality, element);

          expect(profile.effectTags.length).toBeGreaterThan(0);
          expect(profile.potency).toBeGreaterThan(0);
          expect(profile.toxicity).toBeGreaterThanOrEqual(0);
          expect(profile.stability).toBeGreaterThanOrEqual(0);
          expect(profile.stability).toBeLessThanOrEqual(100);
          expect(profile.elementBias).toBe(element);
        }
      }
    }
  });

  it('maps herb wind materials to mana plus detox', () => {
    const profile = buildMaterialAlchemyProfile('herb', '真品', '风');
    expect(profile.effectTags).toEqual(['mana', 'detox']);
  });

  it('maps ore thunder materials to willpower tempering', () => {
    const profile = buildMaterialAlchemyProfile('ore', '真品', '雷');
    expect(profile.effectTags).toEqual(['tempering_willpower']);
  });

  it('maps monster wood materials to spirit tempering', () => {
    const profile = buildMaterialAlchemyProfile('monster', '真品', '木');
    expect(profile.effectTags).toEqual(['tempering_spirit']);
  });

  it('maps tcdb wind materials to healing plus mana', () => {
    const profile = buildMaterialAlchemyProfile('tcdb', '真品', '风');
    expect(profile.effectTags).toEqual(['healing', 'mana']);
  });

  it('keeps aux ice materials as detox-only', () => {
    const profile = buildMaterialAlchemyProfile('aux', '真品', '冰');
    expect(profile.effectTags).toEqual(['detox']);
  });
});
