vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('./cultivatorService', () => ({
  addConsumableToInventory: vi.fn(),
}));

import type { MaterialAlchemyProfile } from '@shared/types/consumable';
import type { PreparedAlchemyIngredient } from './alchemyServiceV2';
import { synthesizeAlchemy } from './alchemyServiceV2';

function createProfile(
  effectTags: MaterialAlchemyProfile['effectTags'],
  overrides: Partial<Omit<MaterialAlchemyProfile, 'effectTags'>> = {},
): MaterialAlchemyProfile {
  return {
    effectTags,
    elementBias: '木',
    potency: 26,
    toxicity: 2,
    stability: 72,
    ...overrides,
  };
}

function createIngredient(
  overrides: Partial<PreparedAlchemyIngredient> & Pick<PreparedAlchemyIngredient, 'id' | 'name' | 'element' | 'type' | 'profile'>,
): PreparedAlchemyIngredient {
  return {
    id: overrides.id,
    name: overrides.name,
    rank: '真品',
    element: overrides.element,
    type: overrides.type,
    dose: overrides.dose ?? 1,
    profile: overrides.profile,
  };
}

describe('synthesizeAlchemy', () => {
  it('builds a hybrid pill when healing and mana stay close enough', () => {
    const result = synthesizeAlchemy(
      [
        createIngredient({
          id: 'm1',
          name: '青岚草',
          element: '木',
          type: 'herb',
          profile: createProfile(['healing']),
        }),
        createIngredient({
          id: 'm2',
          name: '灵泉露',
          element: '水',
          type: 'herb',
          profile: createProfile(['mana']),
        }),
      ],
      {
        targetTags: ['healing', 'mana'],
        focusMode: 'balanced',
      },
      '真品',
    );

    expect(result.family).toBe('hybrid');
    expect(result.operations).toEqual([
      { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 132 },
      { type: 'restore_resource', resource: 'mp', mode: 'flat', value: 99 },
      { type: 'change_gauge', gauge: 'pillToxicity', delta: 6 },
    ]);
  });

  it('routes tempering pills to the strongest tempering track', () => {
    const result = synthesizeAlchemy(
      [
        createIngredient({
          id: 'm1',
          name: '流炎玄矿',
          element: '火',
          type: 'ore',
          profile: createProfile(['tempering_spirit']),
        }),
      ],
      {
        targetTags: ['tempering_spirit'],
        focusMode: 'focused',
      },
      '真品',
    );

    expect(result.family).toBe('tempering');
    expect(result.trackPath).toBe('tempering.spirit');
    expect(result.operations[0]).toEqual({
      type: 'advance_track',
      track: 'tempering.spirit',
      value: 66,
    });
  });

  it('applies low-stability penalties to restore and toxicity operations', () => {
    const result = synthesizeAlchemy(
      [
        createIngredient({
          id: 'm1',
          name: '裂火草',
          element: '木',
          type: 'herb',
          profile: createProfile(['healing'], {
            stability: 20,
            toxicity: 6,
          }),
        }),
        createIngredient({
          id: 'm2',
          name: '凝霜露',
          element: '水',
          type: 'herb',
          profile: createProfile(['mana'], {
            stability: 20,
            toxicity: 7,
          }),
        }),
        createIngredient({
          id: 'm3',
          name: '焚心藤',
          element: '火',
          type: 'herb',
          profile: createProfile(['breakthrough'], {
            stability: 20,
            toxicity: 8,
          }),
        }),
      ],
      {
        targetTags: ['healing'],
        focusMode: 'risky',
      },
      '真品',
    );

    expect(result.family).toBe('healing');
    expect(result.stability).toBe(15);
    expect(result.operations).toEqual([
      { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 159 },
      { type: 'change_gauge', gauge: 'pillToxicity', delta: 8 },
      { type: 'remove_status', status: 'minor_wound' },
    ]);
  });

  it('uses requested element bias as a tie-breaker within ten percent', () => {
    const result = synthesizeAlchemy(
      [
        createIngredient({
          id: 'm1',
          name: '青岚草',
          element: '木',
          type: 'herb',
          profile: createProfile(['healing'], {
            potency: 100,
          }),
        }),
        createIngredient({
          id: 'm2',
          name: '灵泉露',
          element: '水',
          type: 'herb',
          profile: createProfile(['mana'], {
            potency: 95,
          }),
        }),
      ],
      {
        targetTags: ['healing'],
        focusMode: 'focused',
        requestedElementBias: '水',
      },
      '真品',
    );

    expect(result.dominantElement).toBe('水');
  });
});
