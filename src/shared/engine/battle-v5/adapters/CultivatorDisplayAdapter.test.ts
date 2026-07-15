import { getArtifactWearerRealmFactor } from '@shared/engine/shared/artifactRealmScaling';
import type { Cultivator } from '@shared/types/cultivator';
import { AttributeType, ModifierType } from '../core/types';
import {
  createDisplayUnitFromCultivator,
  getCultivatorDisplayAttributes,
  getCultivatorDisplaySnapshot,
} from './CultivatorDisplayAdapter';

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
    spirit_stones: 0,
  };
}

describe('CultivatorDisplayAdapter', () => {
  it('mounts gongfa modifiers and equipped artifact modifiers onto Unit', () => {
    const unit = createDisplayUnitFromCultivator(createCultivatorFixture());

    expect(unit.attributes.getValue(AttributeType.VITALITY)).toBe(15);
    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(12);
    expect(unit.attributes.getValue(AttributeType.SPEED)).toBe(10);
    expect(unit.getMaxHp()).toBe(583);
    expect(unit.getMaxMp()).toBe(383);
  });

  it('mounts sect method modifiers with the same final values used in combat', () => {
    const cultivator = createCultivatorFixture();
    cultivator.attributes.speed = 100;
    const sect = {
      membershipId: 'member-1',
      sectId: 'lingxiao',
      status: 'active',
      contribution: 0,
      configVersion: 3,
      methods: { 'lingxiao-canon': 100 },
      paths: [],
      abilityLoadout: [null, null, null, null],
    } satisfies NonNullable<Cultivator['sect']>;
    const withoutSect = createCultivatorFixture();
    withoutSect.attributes.speed = 100;
    const baseline = createDisplayUnitFromCultivator(withoutSect);
    const project = (methods: NonNullable<Cultivator['sect']>['methods']) => {
      cultivator.sect = { ...sect, methods };
      return createDisplayUnitFromCultivator(cultivator);
    };
    const sword = project({ 'lingxiao-canon': 100, 'sword-guidance': 100 });
    const voidStep = project({ 'lingxiao-canon': 100, 'void-step': 100 });
    const cleansing = project({ 'lingxiao-canon': 100, 'edge-cleansing': 100 });
    const returning = project({
      'lingxiao-canon': 100,
      'origin-returning': 100,
    });
    const swordBody = project({
      'lingxiao-canon': 100,
      'sword-nurturing': 100,
    });

    expect(sword.attributes.getValue(AttributeType.ATK)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.ATK) * 1.05,
    );
    expect(
      voidStep.attributes.getValue(AttributeType.EVASION_RATE),
    ).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.EVASION_RATE) + 0.02,
    );
    expect(cleansing.attributes.getValue(AttributeType.ACCURACY)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.ACCURACY) + 0.02,
    );
    expect(returning.attributes.getValue(AttributeType.MAGIC_DEF)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.MAGIC_DEF) * 1.05,
    );
    expect(swordBody.attributes.getValue(AttributeType.DEF)).toBeCloseTo(
      baseline.attributes.getValue(AttributeType.DEF) * 1.05,
    );
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

  it('applies body cultivation modifiers without changing primary attributes', () => {
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
            skin: { level: 5, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
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

    const { attrs, finalAttributes } =
      getCultivatorDisplayAttributes(cultivator);

    expect(finalAttributes.vitality).toBe(15);
    expect(attrs.maxHp).toBe(652);
    expect(attrs.def).toBeCloseTo(32.96, 6);
  });

  it('builds a serializable display snapshot from battle-v5 attrs and resources', () => {
    const cultivator = createCultivatorFixture();
    cultivator.condition = {
      version: 1,
      resources: {
        hp: { current: 320 },
        mp: { current: 180 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
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

    const snapshot = getCultivatorDisplaySnapshot(cultivator);

    expect(snapshot.attrs.vitality).toBe(15);
    expect(snapshot.attrs.spirit).toBe(12);
    expect(snapshot.attrs.maxHp).toBe(583);
    expect(snapshot.attrs.maxMp).toBe(383);
    expect(snapshot.resources.hp).toEqual({
      current: 320,
      max: 583,
      percent: 54.89,
    });
    expect(snapshot.resources.mp).toEqual({
      current: 180,
      max: 383,
      percent: 47,
    });
  });

  it('applies cross-realm decay on artifact main panel fixed modifiers in display adapter', () => {
    const cultivator = createCultivatorFixture();
    cultivator.inventory.artifacts[0].attributeModifiers = [
      {
        attrType: AttributeType.SPIRIT,
        type: ModifierType.FIXED,
        value: 100,
      },
      {
        attrType: AttributeType.CRIT_RATE,
        type: ModifierType.FIXED,
        value: 0.1,
      },
    ];
    cultivator.inventory.artifacts[0].productModel = {
      productType: 'artifact',
      metadata: { anchorRealm: '金丹', anchorRealmStage: '圆满' },
    };

    const unit = createDisplayUnitFromCultivator(cultivator);
    const factor = getArtifactWearerRealmFactor('金丹', '圆满', '炼气', '初期');

    // 金丹圆满->炼气初期 uses inverse anchor/wearer factor.
    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(
      Math.floor(10 + 100 * factor),
    );
    // 功能属性不衰减
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(
      0.144884,
      6,
    );
  });

  it('clamps legacy over-cap resource values when building the display snapshot', () => {
    const cultivator = createCultivatorFixture();
    cultivator.condition = {
      version: 1,
      resources: {
        hp: { current: 9999 },
        mp: { current: 9999 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
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

    const snapshot = getCultivatorDisplaySnapshot(cultivator);

    expect(snapshot.resources.hp.current).toBe(snapshot.attrs.maxHp);
    expect(snapshot.resources.hp.percent).toBe(100);
    expect(snapshot.resources.mp.current).toBe(snapshot.attrs.maxMp);
    expect(snapshot.resources.mp.percent).toBe(100);
  });
});
