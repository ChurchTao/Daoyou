import { AttributeType, ModifierType } from '../core/types';
import { createDisplayUnitFromCultivator, getCultivatorDisplayAttributes } from './CultivatorDisplayAdapter';
import type { Cultivator } from '@/types/cultivator';

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
          ],
        },
        {
          id: 'artifact-idle',
          name: '离火环',
          slot: 'weapon',
          element: '火',
          attributeModifiers: [
            {
              attrType: AttributeType.SPEED,
              type: ModifierType.FIXED,
              value: 99,
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

describe('CultivatorDisplayAdapter', () => {
  it('mounts gongfa modifiers and equipped artifact modifiers onto Unit', () => {
    const unit = createDisplayUnitFromCultivator(createCultivatorFixture());

    expect(unit.attributes.getValue(AttributeType.VITALITY)).toBe(15);
    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(12);
    expect(unit.attributes.getValue(AttributeType.SPEED)).toBe(10);
    expect(unit.getMaxHp()).toBe(440);
    expect(unit.getMaxMp()).toBe(190);
  });

  it('maps Unit values back to cultivator display attributes', () => {
    const { finalAttributes } = getCultivatorDisplayAttributes(
      createCultivatorFixture(),
    );

    expect(finalAttributes.vitality).toBe(15);
    expect(finalAttributes.spirit).toBe(12);
    expect(finalAttributes.speed).toBe(10);
    expect(finalAttributes.willpower).toBe(10);
  });
});
