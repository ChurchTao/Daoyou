import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { Cultivator } from '@shared/types/cultivator';
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
    spiritual_roots: [{ element: '火', strength: 82, grade: '真灵根' }],
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
              anchorRealmStage: '圆满',
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
    spirit_stones: 0,
  };
}

describe('CultivatorCombatAdapter', () => {
  it('applies cross-realm decay only to main panel fixed modifiers', () => {
    const unit = createCombatUnitFromCultivator(createCultivatorFixture());

    // 金丹圆满->炼气初期 uses inverse anchor/wearer factor.
    expect(unit.attributes.getValue(AttributeType.ATK)).toBeCloseTo(
      119.772343,
      6,
    );
    // CRIT_RATE is functional attribute and should not be decayed
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(
      0.143913,
      6,
    );
  });

  it('injects spiritual roots into runtime metadata and preserves them after clone', () => {
    const unit = createCombatUnitFromCultivator(createCultivatorFixture());
    const clone = unit.clone();

    expect(unit.getSpiritualRoots()).toEqual([
      { element: '火', strength: 82, grade: '真灵根' },
    ]);
    expect(clone.getSpiritualRoots()).toEqual(unit.getSpiritualRoots());
  });

  it('mounts body cultivation modifiers in combat units', () => {
    const cultivator = createCultivatorFixture();
    cultivator.condition = {
      version: 1,
      resources: {
        hp: { current: 0 },
        mp: { current: 0 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 5, progress: 0 },
          },
          milestones: {},
        },
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    };

    const unit = createCombatUnitFromCultivator(cultivator);

    expect(unit.attributes.getValue(AttributeType.VITALITY)).toBe(10);
    expect(unit.attributes.getValue(AttributeType.MAX_HP)).toBe(526);
    expect(unit.attributes.getValue(AttributeType.CONTROL_RESISTANCE)).toBeCloseTo(
      0.083704,
      6,
    );
  });
});
