import { describe, expect, it } from 'vitest';
import { generateForgedEquipment } from '../equipment/forging.js';
import { DAO_EQUIPMENT_SLOTS } from '@daoyou/game-domain/equipment';
import { BLUEPRINTS } from '@daoyou/game-content/items/equipment';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { REALM_VALUES } from '@daoyou/constants/realms';
import {
  artifactBlueprintCount,
  artifactMigrationPlan,
  artifactMigrationRealm,
  drawArtifactBlueprints,
} from './rules.js';

describe('旧法宝兑换', () => {
  it('仅神品额外获得50万灵石，不赠送消耗品且不改变境界或评分图纸', () => {
    for (const quality of [...QUALITY_VALUES, null, '无效']) {
      for (const score of [1, 2000, 3000, 3500, 4000]) {
        const plan = artifactMigrationPlan({
          quality,
          score,
          productModel: null,
        });
        expect(plan.realm).toBe('金丹');
        expect(plan.blueprints).toBe(artifactBlueprintCount(score));
        expect(plan.spiritStones).toBe(quality === '神品' ? 500_000 : 0);
        expect(plan.bonusGrants).toEqual([]);
      }
    }
    expect(() =>
      artifactMigrationPlan({ quality: '神品', score: 0, productModel: null }),
    ).toThrow();
  });
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
      quality: '神品',
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
          quality: '神品',
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
});
