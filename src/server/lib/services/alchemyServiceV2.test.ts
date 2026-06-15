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
      { rng: () => 0.5 },
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
      value: 0.4,
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
      { rng: () => 0.5 },
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
      { rng: () => 0.5 },
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

  it('rolls pill appearance from rng and removes positive toxicity for perfect pills', () => {
    const craft = (rng: () => number) =>
      synthesizeAlchemy(
        [
          createMaterial({
            id: 'm1',
            materialRef: 'material_1',
            name: '回春草',
            description: '可补充气血。',
            element: '木',
            type: 'herb',
          }),
        ],
        {
          materialVectors: [
            {
              materialRef: 'material_1',
              materialName: '回春草',
              properties: [{ key: 'restore_hp', weight: 1 }],
            },
          ],
          intentVector: [{ key: 'restore_hp', weight: 1 }],
          focusMode: 'focused',
        },
        '真品',
        '筑基',
        { rng },
      );

    expect(craft(() => 0).appearance).toBe('low');
    expect(craft(() => 0.3).appearance).toBe('middle');
    expect(craft(() => 0.7).appearance).toBe('high');
    const perfect = craft(() => 0.9);
    expect(perfect.appearance).toBe('perfect');
    expect(
      perfect.operations.some(
        (operation) =>
          operation.type === 'change_gauge' && operation.delta > 0,
      ),
    ).toBe(false);
  });

  it('does not add extra toxicity when detox is part of a compound route', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '净心叶',
          description: '可化解丹毒，也能温养气血。',
          element: '木',
          type: 'herb',
        }),
        createMaterial({
          id: 'm2',
          materialRef: 'material_2',
          name: '回春草',
          description: '可补充气血。',
          element: '木',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '净心叶',
            properties: [{ key: 'detox', weight: 1 }],
          },
          {
            materialRef: 'material_2',
            materialName: '回春草',
            properties: [{ key: 'restore_hp', weight: 1 }],
          },
        ],
        intentVector: [
          { key: 'detox', weight: 0.5 },
          { key: 'restore_hp', weight: 0.5 },
        ],
        focusMode: 'balanced',
      },
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    const toxicityOperations = result.operations.filter(
      (operation) => operation.type === 'change_gauge',
    );
    expect(toxicityOperations).toEqual([
      {
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: -23,
      },
    ]);
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
      { rng: () => 0.5 },
    );

    expect(result.family).toBe('hybrid');
    expect(result.operations).toContainEqual({
      type: 'restore_resource',
      resource: 'hp',
      mode: 'percent',
      value: 0.4,
    });
    expect(result.operations).toContainEqual({
      type: 'restore_resource',
      resource: 'mp',
      mode: 'percent',
      value: 0.3,
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
      { rng: () => 0.5 },
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
      { rng: () => 0.5 },
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
      payload: {
        breakthroughChanceBonus: 0.0629,
      },
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
      { rng: () => 0.5 },
    );

    expect(result.family).toBe('breakthrough');
    expect(result.propertyVector).toEqual([
      { key: 'clear_mind_support', weight: 1 },
    ]);
    expect(result.operations).toContainEqual({
      type: 'add_status',
      status: 'clear_mind',
      usesRemaining: 2,
      payload: {
        preventsInnerDemon: true,
      },
    });
    expect(
      result.operations.some(
        (operation) =>
          operation.type === 'gain_progress' &&
          operation.target === 'comprehension_insight',
      ),
    ).toBe(false);
  });

  it('turns protect-meridians routes into breakthrough pills that grant protect_meridians status', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '护络藤',
          description: '藤性绵长，可护脉稳络，镇住冲关时经脉震荡。',
          element: '木',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '护络藤',
            properties: [{ key: 'protect_meridians_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'protect_meridians_support', weight: 1 }],
        focusMode: 'focused',
      },
      '真品',
      '元婴',
      { rng: () => 0.5 },
    );

    expect(result.family).toBe('breakthrough');
    expect(result.propertyVector).toEqual([
      { key: 'protect_meridians_support', weight: 1 },
    ]);
    expect(result.operations).toContainEqual({
      type: 'add_status',
      status: 'protect_meridians',
      usesRemaining: 1,
      payload: {
        failureExpLossReductionPercent: 0.4143,
      },
    });
    expect(
      result.operations.some(
        (operation) =>
          operation.type === 'add_status' &&
          operation.status === 'breakthrough_focus',
      ),
    ).toBe(false);
  });

  it('turns cultivation routes into one-use retreat cultivation boost pills', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '金霞芝',
          description: '芝气温养，可积蓄修为。',
          element: '金',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '金霞芝',
            properties: [{ key: 'cultivation', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'cultivation', weight: 1 }],
        focusMode: 'focused',
      },
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    expect(result.family).toBe('cultivation');
    expect(result.operations).toContainEqual({
      type: 'add_status',
      status: 'cultivation_boost',
      usesRemaining: 1,
      payload: {
        boostPercent: 0.4857,
        retreatExpMultiplier: 1.4857,
      },
    });
    expect(result.appearance).toBe('middle');
    expect(
      result.operations.some(
        (operation) =>
          operation.type === 'gain_progress' &&
          operation.target === 'cultivation_exp',
      ),
    ).toBe(false);
  });

  it('scales cultivation boost by property order and low stability while clamping the final range', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '妖丹',
          description: '药力驳杂，主养气，兼可疗伤回元。',
          element: '火',
          type: 'monster',
          rank: '地品',
        }),
        createMaterial({
          id: 'm2',
          materialRef: 'material_2',
          name: '兽骨粉',
          description: '燥烈难驯，药路偏杂。',
          element: '土',
          type: 'monster',
          rank: '地品',
        }),
        createMaterial({
          id: 'm3',
          materialRef: 'material_3',
          name: '血晶砂',
          description: '性烈，炉中易冲。',
          element: '火',
          type: 'monster',
          rank: '地品',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '妖丹',
            properties: [{ key: 'restore_hp', weight: 1 }],
          },
          {
            materialRef: 'material_2',
            materialName: '兽骨粉',
            properties: [{ key: 'restore_mp', weight: 1 }],
          },
          {
            materialRef: 'material_3',
            materialName: '血晶砂',
            properties: [{ key: 'cultivation', weight: 1 }],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.34 },
          { key: 'restore_mp', weight: 0.33 },
          { key: 'cultivation', weight: 0.33 },
        ],
        focusMode: 'risky',
      },
      '地品',
      '金丹',
      { rng: () => 0.5 },
    );

    const boost = result.operations.find(
      (operation) =>
        operation.type === 'add_status' &&
        operation.status === 'cultivation_boost',
    );

    expect(result.stability).toBeLessThan(45);
    expect(boost).toMatchObject({
      type: 'add_status',
      status: 'cultivation_boost',
      payload: {
        boostPercent: 0.2703,
        retreatExpMultiplier: 1.2703,
      },
    });
  });

  it('turns lifespan routes into longevity pills with a fixed rolled lifespan value', () => {
    const result = synthesizeAlchemy(
      [
        createMaterial({
          id: 'm1',
          materialRef: 'material_1',
          name: '寿元果',
          description: '果中生机绵长，可固本延寿，续补命元。',
          element: '木',
          type: 'herb',
        }),
      ],
      {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '寿元果',
            properties: [{ key: 'extend_lifespan', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'extend_lifespan', weight: 1 }],
        focusMode: 'focused',
      },
      '真品',
      '金丹',
      { rng: () => 0.5 },
    );

    expect(result.family).toBe('longevity');
    expect(result.propertyVector).toEqual([{ key: 'extend_lifespan', weight: 1 }]);
    expect(result.operations).toContainEqual({
      type: 'increase_lifespan',
      value: 91,
    });
    expect(result.operations).toContainEqual({
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta: 23,
    });
  });
});
