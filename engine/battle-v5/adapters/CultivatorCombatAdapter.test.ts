import { GameplayTags } from '@/engine/shared/tag-domain';
import type { Cultivator } from '@/types/cultivator';
import { AbilityType, AttributeType, ModifierType } from '../core/types';
import { createCombatUnitFromCultivator } from './CultivatorCombatAdapter';

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
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [
        {
          id: 'artifact-equipped',
          name: '太虚戒',
          slot: 'accessory',
          element: '金',
          abilityConfig: {
            slug: 'artifact-equipped',
            name: '太虚戒',
            type: AbilityType.PASSIVE_SKILL,
            tags: [GameplayTags.ABILITY.KIND.ARTIFACT],
            modifiers: [
              {
                attrType: AttributeType.ATK,
                type: ModifierType.FIXED,
                value: 100,
              },
              {
                attrType: AttributeType.CRIT_RATE,
                type: ModifierType.FIXED,
                value: 0.1,
              },
            ],
          },
          productModel: {
            productType: 'artifact',
            metadata: {
              anchorRealm: '金丹',
            },
          },
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

describe('CultivatorCombatAdapter', () => {
  it('applies cross-realm decay only to main panel fixed modifiers', () => {
    const unit = createCombatUnitFromCultivator(createCultivatorFixture());

    // Base ATK = VITALITY*4 + SPEED*1 = 50; 金丹->炼气 diff=2 => factor=0.55, +55
    expect(unit.attributes.getValue(AttributeType.ATK)).toBe(105);
    // CRIT_RATE is functional attribute and should not be decayed
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(0.153, 6);
  });
});

