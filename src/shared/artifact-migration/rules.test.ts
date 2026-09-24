import { describe, expect, it } from 'vitest';
import { ExchangeArtifactSchema } from '../contracts/artifactMigration';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment/types';
import { BLUEPRINTS } from '../items/definitions/equipment-blueprints';
import { REALM_VALUES } from '../types/constants';
import {
  artifactBlueprintCount,
  artifactMigrationPlan,
  artifactMigrationRealm,
  drawArtifactBlueprints,
} from './rules';

describe('旧法宝兑换', () => {
  it('保留大境界且最高化神，不继承小阶段', () => {
    expect(
      REALM_VALUES.map(
        (anchorRealm) =>
          artifactMigrationRealm({
            metadata: { anchorRealm, anchorRealmStage: '圆满' },
          }).equipmentLevel,
      ),
    ).toEqual([10, 30, 50, 70, 90, 90, 90, 90, 90]);
    expect(
      artifactMigrationRealm({ metadata: { anchorRealm: '渡劫' } }),
    ).toMatchObject({ anchorRealm: '渡劫', realm: '化神', fallback: false });
  });
  it('缺失或非法锚定境界统一回退金丹', () => {
    for (const productModel of [
      null,
      [],
      {},
      { metadata: null },
      { metadata: { anchorRealm: '未知' } },
      { metadata: { anchorRealm: 170 } },
    ]) {
      expect(artifactMigrationRealm(productModel)).toEqual({
        anchorRealm: null,
        realm: '金丹',
        equipmentLevel: 50,
        fallback: true,
      });
    }
  });
  it('评分档包含边界且最高四张', () => {
    expect(
      [1, 1999, 2000, 2999, 3000, 3499, 3500, 3999, 4000, 4380, 999999].map(
        artifactBlueprintCount,
      ),
    ).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
    for (const score of [0, -1, 1.5, NaN, Infinity])
      expect(() => artifactBlueprintCount(score)).toThrow();
  });
  it('逐张均匀抽取六部位，允许重复并合并数量', () => {
    const plan = artifactMigrationPlan({
      score: 4200,
      productModel: { metadata: { anchorRealm: '合体' } },
    });
    for (let i = 0; i < 6; i++) {
      const grants = drawArtifactBlueprints(plan, () => (i + 0.5) / 6);
      expect(grants).toEqual([
        { definitionId: `blueprint.${DAO_EQUIPMENT_SLOTS[i]}.90`, quantity: 4 },
      ]);
      expect(BLUEPRINTS.some((b) => b.id === grants[0].definitionId)).toBe(
        true,
      );
    }
    expect(
      drawArtifactBlueprints({ ...plan, blueprints: 0 }, () => {
        throw Error('不应抽取');
      }),
    ).toEqual([]);
    expect(() => drawArtifactBlueprints(plan, () => 1)).toThrow();
  });
  it('所有映射档位均可生成所选部位的合法成品及图纸', () => {
    for (const anchorRealm of REALM_VALUES)
      for (const slot of DAO_EQUIPMENT_SLOTS) {
        const plan = artifactMigrationPlan({
          score: 3500,
          productModel: { metadata: { anchorRealm } },
        });
        const generated = generateForgedEquipment({
          id: 'fixture',
          createdAt: '2026-09-24T00:00:00.000Z',
          seed: 42,
          templateId: `dao_equipment.standard.${slot}.v1`,
          equipmentLevel: plan.equipmentLevel,
          weaponType: slot === 'weapon' ? 'fan' : undefined,
          baseQuality: 0,
          boosts: { ore: 0, essence: 0, attributes: 0 },
        });
        expect(generated.ok).toBe(true);
        if (generated.ok)
          expect(generated.instance).toMatchObject({
            slot,
            equipmentLevel: plan.equipmentLevel,
            requiredLevel: plan.equipmentLevel - 5,
          });
        expect(
          drawArtifactBlueprints(plan, () => 0.5).every((g) =>
            BLUEPRINTS.some((b) => b.id === g.definitionId),
          ),
        ).toBe(true);
      }
  });
  it('不接受客户端指定境界、评分，法兵必须选合法器形', () => {
    const base = {
      productId: '8c9fe71d-2b24-4253-8c91-cfe8cb8f1b35',
      slot: 'weapon',
    };
    expect(
      ExchangeArtifactSchema.safeParse({ ...base, weaponType: 'fan' }).success,
    ).toBe(true);
    for (const value of [
      base,
      { ...base, weaponType: 'fake' },
      { ...base, slot: 'armor', weaponType: 'sword' },
      { ...base, slot: 'armor', equipmentLevel: 90 },
      { ...base, slot: 'armor', score: 9999 },
    ])
      expect(ExchangeArtifactSchema.safeParse(value).success).toBe(false);
    expect(
      ExchangeArtifactSchema.safeParse({ ...base, slot: 'head' }).success,
    ).toBe(true);
  });
});
