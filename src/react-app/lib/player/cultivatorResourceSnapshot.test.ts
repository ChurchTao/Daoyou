import { describe, expect, it } from 'vitest';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { Cultivator } from '@shared/types/cultivator';
import { getCultivatorResourceSnapshot } from './cultivatorResourceSnapshot';

function createCultivatorFixture(): Cultivator {
  return {
    id: 'cultivator-1',
    name: '测试道友',
    title: null,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 120,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [
      {
        id: 'gongfa-1',
        name: '太初吐纳诀',
        attributeModifiers: [
          {
            attrType: AttributeType.VITALITY,
            type: ModifierType.FIXED,
            value: 5,
          },
          {
            attrType: AttributeType.MAX_HP,
            type: ModifierType.FIXED,
            value: 20,
          },
          {
            attrType: AttributeType.MAX_MP,
            type: ModifierType.ADD,
            value: 0.1,
          },
        ],
      },
    ],
    skills: [],
    inventory: {
      artifacts: [
        {
          id: 'artifact-equipped',
          name: '玄木佩',
          slot: 'accessory',
          element: '木',
          attributeModifiers: [
            {
              attrType: AttributeType.SPIRIT,
              type: ModifierType.FIXED,
              value: 2,
            },
            {
              attrType: AttributeType.MAX_MP,
              type: ModifierType.FIXED,
              value: 30,
            },
          ],
        },
      ],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: 'artifact-equipped',
    },
    max_skills: 3,
    spirit_stones: 0,
  };
}

describe('getCultivatorResourceSnapshot', () => {
  it('matches the display adapter for primary attributes and resource caps', () => {
    const cultivator = createCultivatorFixture();
    const snapshot = getCultivatorResourceSnapshot(cultivator);
    const display = getCultivatorDisplayAttributes(cultivator);

    expect(snapshot.final).toEqual({
      vitality: display.finalAttributes.vitality,
      spirit: display.finalAttributes.spirit,
      wisdom: display.finalAttributes.wisdom,
      speed: display.finalAttributes.speed,
      willpower: display.finalAttributes.willpower,
    });
    expect(snapshot.maxHp).toBe(display.maxHp);
    expect(snapshot.maxMp).toBe(display.maxMp);
  });

  it('matches cross-realm decay for artifact main-panel modifiers', () => {
    const cultivator = createCultivatorFixture();
    cultivator.inventory.artifacts[0].attributeModifiers = [
      {
        attrType: AttributeType.SPIRIT,
        type: ModifierType.FIXED,
        value: 100,
      },
      {
        attrType: AttributeType.MAX_MP,
        type: ModifierType.FIXED,
        value: 80,
      },
    ];
    cultivator.inventory.artifacts[0].productModel = {
      productType: 'artifact',
      metadata: { anchorRealm: '金丹' },
    };

    const snapshot = getCultivatorResourceSnapshot(cultivator);
    const display = getCultivatorDisplayAttributes(cultivator);

    expect(snapshot.final.spirit).toBe(display.finalAttributes.spirit);
    expect(snapshot.maxMp).toBe(display.maxMp);
  });
});
