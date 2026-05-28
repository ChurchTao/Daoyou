import { AttributeType, ModifierType } from '../core/types';
import {
  createDisplayUnitFromCultivator,
  getCultivatorDisplayAttributes,
  getCultivatorDisplaySnapshot,
} from './CultivatorDisplayAdapter';
import type { Cultivator } from '@shared/types/cultivator';

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
    expect(unit.getMaxMp()).toBe(380);
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
      },
      statuses: [],
      timestamps: {},
    };

    const snapshot = getCultivatorDisplaySnapshot(cultivator);

    expect(snapshot.attrs.vitality).toBe(15);
    expect(snapshot.attrs.spirit).toBe(12);
    expect(snapshot.attrs.maxHp).toBe(440);
    expect(snapshot.attrs.maxMp).toBe(380);
    expect(snapshot.resources.hp).toEqual({
      current: 320,
      max: 440,
      percent: 72.73,
    });
    expect(snapshot.resources.mp).toEqual({
      current: 180,
      max: 380,
      percent: 47.37,
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
      metadata: { anchorRealm: '金丹' },
    };

    const unit = createDisplayUnitFromCultivator(cultivator);

    // 金丹 -> 炼气 diff=2 => factor=0.55，SPIRIT +55
    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(65);
    // 功能属性不衰减
    expect(unit.attributes.getValue(AttributeType.CRIT_RATE)).toBeCloseTo(0.153, 6);
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
