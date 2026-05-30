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

import type { PreparedAlchemyMaterial } from './AlchemyRecipeRules';
import { synthesizeAlchemy } from './alchemyServiceV2';

function createMaterial(
  overrides: Partial<PreparedAlchemyMaterial> &
    Pick<
      PreparedAlchemyMaterial,
      'id' | 'materialRef' | 'name' | 'description' | 'element' | 'type'
    >,
): PreparedAlchemyMaterial {
  return {
    id: overrides.id,
    materialRef: overrides.materialRef,
    name: overrides.name,
    description: overrides.description,
    rank: overrides.rank ?? '真品',
    element: overrides.element,
    type: overrides.type,
    dose: overrides.dose ?? 1,
  };
}

describe('synthesizeAlchemy', () => {
  it('keeps recovery materials on a healing route when both hp and wound healing are selected', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '回春草',
          description: '叶脉温润，常用于补充气血与治愈伤口。',
          element: '木',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '回春草',
            properties: [
              { key: 'restore_hp', weight: 0.6 },
              { key: 'heal_wounds', weight: 0.4 },
            ],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.5 },
          { key: 'heal_wounds', weight: 0.5 },
        ],
        focusMode: 'focused',
      },
      '真品',
      '筑基',
    );

    expect(result.family).toBe('healing');
    expect(result.propertyVector.map((property) => property.key)).toEqual([
      'restore_hp',
      'heal_wounds',
    ]);
    expect(result.operations).toContainEqual({
      type: 'restore_resource',
      resource: 'hp',
      mode: 'percent',
      value: 0.1992,
    });
    expect(result.operations).toContainEqual({
      type: 'remove_status',
      status: 'minor_wound',
    });
  });

  it('changes property vector and operations when the intent direction changes', () => {
    const materials = [
      createMaterial({
        id: 'm1',
        materialRef: 'material_1',
        name: '青岚草',
        description: '生机温润，可补充气血，也能温养灵息。',
        element: '木',
        type: 'herb',
      }),
      createMaterial({
        id: 'm2',
        materialRef: 'material_2',
        name: '灵泉露',
        description: '泉气清灵，常用于回元聚气。',
        element: '水',
        type: 'aux',
      }),
    ];

    const healingResult = synthesizeAlchemy(
      materials,
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [
              { key: 'restore_hp', weight: 0.55 },
              { key: 'heal_wounds', weight: 0.45 },
            ],
          },
          {
            materialRef: 'material_2',
            materialName: '灵泉露',
            properties: [
              { key: 'restore_mp', weight: 0.6 },
              { key: 'detox', weight: 0.4 },
            ],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.55 },
          { key: 'heal_wounds', weight: 0.45 },
        ],
        focusMode: 'focused',
      },
      '真品',
      '筑基',
    );
    const manaResult = synthesizeAlchemy(
      materials,
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [
              { key: 'restore_hp', weight: 0.55 },
              { key: 'heal_wounds', weight: 0.45 },
            ],
          },
          {
            materialRef: 'material_2',
            materialName: '灵泉露',
            properties: [
              { key: 'restore_mp', weight: 0.6 },
              { key: 'detox', weight: 0.4 },
            ],
          },
        ],
        intentVector: [{ key: 'restore_mp', weight: 1 }],
        focusMode: 'focused',
      },
      '真品',
      '筑基',
    );

    expect(healingResult.propertyVector).not.toEqual(manaResult.propertyVector);
    expect(healingResult.family).toBe('healing');
    expect(manaResult.family).toBe('mana');
    expect(healingResult.operations[0]).toMatchObject({
      type: 'restore_resource',
      resource: 'hp',
    });
    expect(manaResult.operations[0]).toMatchObject({
      type: 'restore_resource',
      resource: 'mp',
    });
  });

  it('derives a hybrid family when hp and mp recovery stay close enough', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '回春草',
          description: '可补充气血。',
          element: '木',
          type: 'herb',
        }),
        createMaterial({
          id: 'm2',
          materialRef: 'material_2',
          name: '灵泉露',
          description: '可回元聚气。',
          element: '水',
          type: 'aux',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '回春草',
            properties: [{ key: 'restore_hp', weight: 1 }],
          },
          {
            materialRef: 'material_2',
            materialName: '灵泉露',
            properties: [{ key: 'restore_mp', weight: 1 }],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.5 },
          { key: 'restore_mp', weight: 0.5 },
        ],
        focusMode: 'balanced',
      },
      '真品',
      '筑基',
    );

    expect(result.family).toBe('hybrid');
    expect(result.operations).toContainEqual({
      type: 'restore_resource',
      resource: 'hp',
      mode: 'percent',
      value: 0.1992,
    });
    expect(result.operations).toContainEqual({
      type: 'restore_resource',
      resource: 'mp',
      mode: 'percent',
      value: 0.1121,
    });
  });

  it('lets risky focus change stability and toxicity without changing the selected properties', () => {
    const materials = [
      createMaterial({
        id: 'm1',
        materialRef: 'material_1',
        name: '裂火藤',
        description: '药性猛烈，却有一线护脉之机。',
        element: '火',
        type: 'monster',
      }),
    ];
    const balancedResult = synthesizeAlchemy(
      materials,
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '裂火藤',
            properties: [{ key: 'breakthrough_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'breakthrough_support', weight: 1 }],
        focusMode: 'balanced',
      },
      '真品',
      '筑基',
    );
    const riskyResult = synthesizeAlchemy(
      materials,
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '裂火藤',
            properties: [{ key: 'breakthrough_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'breakthrough_support', weight: 1 }],
        focusMode: 'risky',
      },
      '真品',
      '筑基',
    );

    expect(riskyResult.propertyVector).toEqual(balancedResult.propertyVector);
    expect(riskyResult.stability).toBeLessThan(balancedResult.stability);
    expect(riskyResult.toxicityRating).toBeGreaterThan(
      balancedResult.toxicityRating,
    );
    expect(riskyResult.operations).toContainEqual({
      type: 'add_status',
      status: 'breakthrough_focus',
      usesRemaining: 1,
    });
  });

  it('turns clear-mind routes into breakthrough pills that grant clear_mind status', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '静神芝',
          description: '芝气清宁，可助清心定神，稳住识海。',
          element: '水',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '静神芝',
            properties: [{ key: 'clear_mind_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'clear_mind_support', weight: 1 }],
        focusMode: 'focused',
      },
      '真品',
      '金丹',
    );

    expect(result.family).toBe('breakthrough');
    expect(result.propertyVector).toEqual([
      { key: 'clear_mind_support', weight: 1 },
    ]);
    expect(result.operations).toContainEqual({
      type: 'add_status',
      status: 'clear_mind',
      usesRemaining: 1,
    });
    expect(
      result.operations.some(
        (operation) =>
          operation.type === 'gain_progress' &&
          operation.target === 'comprehension_insight',
      ),
    ).toBe(false);
  });
});
