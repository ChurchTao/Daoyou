import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { getArtifactWearerRealmFactor } from '@shared/engine/shared/artifactRealmScaling';
import type { Cultivator } from '@shared/types/cultivator';
import { EventBus } from '../core/EventBus';
import type { ActionEvent, SkillPreCastEvent } from '../core/events';
import { AbilityType, AttributeType, ModifierType } from '../core/types';
import { Unit } from '../units/Unit';
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
    const factor = getArtifactWearerRealmFactor(
      '金丹',
      '圆满',
      '炼气',
      '初期',
    );

    // 金丹圆满->炼气初期 uses inverse anchor/wearer factor.
    expect(unit.attributes.getValue(AttributeType.ATK)).toBeCloseTo(
      70 + 100 * factor,
      6,
    );
    // CRIT_RATE is functional attribute and should not be decayed
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(
      0.144884,
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

  it('uses the same sect method modifiers as the display adapter', () => {
    const cultivator = createCultivatorFixture();
    cultivator.attributes.speed = 100;
    const sect = {
      membershipId: 'member-1', sectId: 'lingxiao', status: 'active', contribution: 0,
      tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
      methods: { 'lingxiao-canon': 100 },
      meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
      abilityLoadout: [null, null, null, null],
    } satisfies NonNullable<Cultivator['sect']>;
    const baselineCultivator = createCultivatorFixture();
    baselineCultivator.attributes.speed = 100;
    const baseline = createCombatUnitFromCultivator(baselineCultivator);
    const project = (methods: NonNullable<Cultivator['sect']>['methods']) => {
      cultivator.sect = { ...sect, methods };
      return createCombatUnitFromCultivator(cultivator);
    };
    const sword = project({ 'lingxiao-canon': 100, 'sword-guidance': 100 });
    const voidStep = project({ 'lingxiao-canon': 100, 'void-step': 100 });
    const cleansing = project({ 'lingxiao-canon': 100, 'edge-cleansing': 100 });
    const returning = project({ 'lingxiao-canon': 100, 'origin-returning': 100 });

    expect(sword.attributes.getValue(AttributeType.ATK)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.ATK) * 1.05,
    );
    expect(voidStep.attributes.getValue(AttributeType.SPEED)).toBe(104);
    expect(cleansing.attributes.getValue(AttributeType.ACCURACY)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.ACCURACY) + 0.02,
    );
    expect(returning.attributes.getValue(AttributeType.MAX_MP)).toBeCloseTo(
      Math.floor(baseline.attributes.getValue(AttributeType.MAX_MP) * 1.05),
    );
  });

  it('mounts the sect selection strategy instead of the generic strategy', () => {
    const eventBus = EventBus.instance;
    eventBus.reset();
    const cultivator = createCultivatorFixture();
    cultivator.realm = '化神';
    cultivator.realm_stage = '初期';
    cultivator.sect = {
      membershipId: 'member-1',
      sectId: 'lingxiao',
      status: 'active',
      pathId: 'swift-sword',
      contribution: 0,
      tacticId: 'aggressive',
      activeMeridianSlot: 1,
      configVersion: 1,
      methods: {
        'lingxiao-canon': 100,
        'sword-guidance': 100,
        'edge-cleansing': 100,
        'swift-sword-canon': 100,
      },
      meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
      abilityLoadout: [
        'guiding-sword',
        'linked-edge',
        'breaking-edge',
        null,
      ],
    };
    const unit = createCombatUnitFromCultivator(cultivator);
    const opponent = new Unit('opponent', '木桩', {
      [AttributeType.VITALITY]: 100,
    });
    unit.abilities.setDefaultTarget(opponent);

    let selectedAbilityId: string | null = null;
    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      if (event.caster === unit) selectedAbilityId = event.ability.id;
    });
    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: unit,
    });

    expect(selectedAbilityId).toBe('sect.lingxiao.linked-edge');
    unit.abilities.destroy();
    eventBus.reset();
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
    expect(unit.attributes.getValue(AttributeType.MAX_HP)).toBe(562);
    expect(unit.attributes.getValue(AttributeType.CONTROL_RESISTANCE)).toBeCloseTo(
      0.0848,
      6,
    );
  });
});
