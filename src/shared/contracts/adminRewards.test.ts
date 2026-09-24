import { describe, expect, it } from 'vitest';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import { buildSpiritFruitSpec } from '../engine/spirit-field/spiritFruit';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { libraryMaterialGrant } from '../items/libraryMaterialGrant';
import { ITEM_DEFINITIONS } from '../items/registry';
import { resolveAlchemyEffects } from '../lib/alchemyEffectResolver';
import {
  ItemLibraryEntrySchema,
  ItemLibraryMaterialGenerateSchema,
  MailAttachmentsSchema,
} from '../lib/itemLibrary';
import {
  RewardItemSchema,
  RewardSelectionsSchema,
  materializeRewardAttachments,
  materializeRewardItem,
  rewardAttachments,
} from './adminRewards';

const fixed = ITEM_DEFINITIONS.find((d) => d.kind === 'beast_refinement')!;
const equipment = generateForgedEquipment({
  id: 'template',
  createdAt: '2026-09-23T00:00:00Z',
  templateId: 'dao_equipment.standard.weapon.v1',
  equipmentLevel: 10,
  seed: 10,
  baseQuality: 0,
  boosts: { ore: 0, essence: 0, attributes: 0 },
  weaponType: 'sword',
});
if (!equipment.ok) throw new Error('fixture');
const grant = {
  definitionId: 'equipment.v6',
  quantity: 1,
  instanceData: equipment.instance,
};
const fruit = {
  name: '灵果',
  type: '灵果',
  quality: '凡品',
  spec: buildSpiritFruitSpec({ family: 'healing', quality: '凡品' }),
};

describe('current admin rewards', () => {
  it('keeps supported material and seed generation while rejecting retired types', () => {
    for (const materialType of ['herb', 'seed', 'gongfa_manual']) {
      expect(
        ItemLibraryMaterialGenerateSchema.safeParse({
          materialType,
          count: 1,
          quality: '凡品',
        }).success,
      ).toBe(true);
    }
    expect(
      ItemLibraryMaterialGenerateSchema.safeParse({
        materialType: 'mystery',
        count: 1,
        quality: '凡品',
      }).success,
    ).toBe(false);
  });
  it('accepts all fixed inventory definitions without another catalogue', () => {
    for (const d of ITEM_DEFINITIONS.filter(
      (d) => !['equipment', 'material', 'consumable', 'seed'].includes(d.kind),
    ))
      expect(
        RewardItemSchema.safeParse({ definitionId: d.id, quantity: 2 }).success,
        d.id,
      ).toBe(true);
  });
  it('rejects unknown definitions, mismatched facts, fixed-item facts and equipment stacks', () => {
    for (const input of [
      { definitionId: 'unknown', quantity: 1 },
      { definitionId: 'material.v1', quantity: 1, instanceData: fruit },
      { definitionId: fixed.id, quantity: 1, instanceData: fruit },
      { ...grant, quantity: 2 },
      { definitionId: 'seed.v1', quantity: 1 },
    ])
      expect(RewardItemSchema.safeParse(input).success).toBe(false);
  });
  it('validates executable consumable effects, type and active talisman scenarios', () => {
    expect(
      RewardItemSchema.safeParse({
        definitionId: 'consumable.v1',
        quantity: 99,
        instanceData: fruit,
      }).success,
    ).toBe(true);
    expect(
      ConsumableFactsSchema.safeParse({ ...fruit, spec: { kind: 'pill' } })
        .success,
    ).toBe(false);
    expect(
      ConsumableFactsSchema.safeParse({
        ...fruit,
        spec: {
          ...fruit.spec,
          operations: [
            { type: 'gain_progress', target: 'cultivation_exp', value: -1 },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      RewardItemSchema.safeParse({
        definitionId: 'consumable.v1',
        quantity: 1,
        instanceData: { ...fruit, type: '丹药' },
      }).success,
    ).toBe(false);
    expect(
      RewardItemSchema.safeParse({
        definitionId: 'consumable.v1',
        quantity: 1,
        instanceData: {
          ...fruit,
          type: '符箓',
          spec: {
            kind: 'talisman',
            scenario: 'retired',
            sessionMode: 'consume_on_action',
          },
        },
      }).success,
    ).toBe(false);
  });
  it('preserves production V4 metadata and effects', () => {
    const operations = resolveAlchemyEffects({
      route: { effects: [{ key: 'cultivation', weight: 1 }] },
      quality: '灵品',
      appearance: 'high',
    }).operations;
    const spec = {
      kind: 'pill',
      family: 'cultivation',
      operations,
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'cultivation',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        stability: 90,
        toxicityRating: 20,
        tags: [],
        version: 4,
        appearance: 'high',
        batch: { compoundTier: 'single' },
      },
    };
    expect(
      ConsumableFactsSchema.parse({ ...fruit, type: '丹药', spec }).spec,
    ).toEqual(spec);
  });
  it('freezes effects while assigning fresh equipment identities on every delivery', () => {
    const first = materializeRewardItem(grant, () => 'recipient-one');
    const second = materializeRewardItem(grant, () => 'recipient-two');
    expect(first.instanceData).toEqual({
      ...equipment.instance,
      id: 'recipient-one',
    });
    expect(second.instanceData).toEqual({
      ...equipment.instance,
      id: 'recipient-two',
    });
    expect(grant.instanceData.id).toBe('template');
    const attachments = rewardAttachments([
      { type: 'inventory_v1', inventory: grant },
    ]);
    expect(
      materializeRewardAttachments(attachments, () => 'claim').at(0)?.inventory
        ?.instanceData,
    ).toEqual({ ...equipment.instance, id: 'claim' });
    expect(MailAttachmentsSchema.parse(attachments)[0].type).toBe(
      'inventory_v1',
    );
  });
  it('keeps legacy manual categories as V1 materials and historical attachments unchanged', () => {
    for (const type of ['gongfa_manual', 'skill_manual']) {
      const entry = ItemLibraryEntrySchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        itemId: 'source',
        type: 'material',
        status: 'published',
        name: '旧藏',
        payload: { name: '旧藏', type, rank: '凡品' },
        editorConfig: {},
        createdBy: '00000000-0000-4000-8000-000000000002',
        updatedBy: '00000000-0000-4000-8000-000000000002',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(libraryMaterialGrant(entry)).toMatchObject({
        definitionId: 'material.v1',
        instanceData: { type },
      });
    }
    const old = [
      {
        type: 'material' as const,
        name: '旧藏',
        quantity: 1,
        data: {
          name: '旧藏',
          type: 'herb' as const,
          rank: '凡品' as const,
          quantity: 1,
        },
      },
    ];
    expect(materializeRewardAttachments(old, () => 'unused')).toEqual(old);
  });
  it('rejects legacy authoring and invalid quantities', () => {
    expect(
      RewardSelectionsSchema.safeParse([
        { type: 'item_library', itemId: 'old', quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(
      RewardSelectionsSchema.safeParse([{ type: 'reputation', quantity: -1 }])
        .success,
    ).toBe(false);
  });
});
