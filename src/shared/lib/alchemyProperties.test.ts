import { describe, expect, it } from 'vitest';
import {
  canonicalizeAlchemyPropertyKey,
  GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES,
  normalizeWeightedAlchemyProperties,
} from './alchemyProperties';

describe('alchemy property canonicalization', () => {
  it('keeps legacy tempering properties out of new generation candidates', () => {
    expect(
      GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES.filter((key) =>
        key.startsWith('tempering_'),
      ),
    ).toEqual([]);
    expect(GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES).toEqual(
      expect.arrayContaining([
        'body_skin',
        'body_sinew_bone',
        'body_organs',
        'body_qi_blood',
        'body_primordial_spirit',
      ]),
    );
  });

  it('canonicalizes legacy tempering properties into body-cultivation properties', () => {
    expect(canonicalizeAlchemyPropertyKey('tempering_vitality')).toBe(
      'body_qi_blood',
    );
    expect(canonicalizeAlchemyPropertyKey('tempering_spirit')).toBe(
      'body_organs',
    );
    expect(canonicalizeAlchemyPropertyKey('tempering_wisdom')).toBe(
      'body_primordial_spirit',
    );
    expect(canonicalizeAlchemyPropertyKey('tempering_speed')).toBe(
      'body_skin',
    );
    expect(canonicalizeAlchemyPropertyKey('tempering_willpower')).toBe(
      'body_sinew_bone',
    );
  });

  it('merges legacy and body properties during normalization', () => {
    expect(
      normalizeWeightedAlchemyProperties([
        { key: 'tempering_spirit', weight: 1 },
        { key: 'body_organs', weight: 1 },
      ]),
    ).toEqual([{ key: 'body_organs', weight: 1 }]);
  });
});
