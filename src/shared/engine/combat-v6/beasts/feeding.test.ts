import { resolveAlchemyEffects } from '@shared/lib/alchemyEffectResolver';
import type { PillSpec } from '@shared/types/consumable';
import { describe, expect, it } from 'vitest';
import { buildSpiritFruitSpec } from '../../spirit-field/spiritFruit';
import { BEAST_SPECIES } from './content';
import { beastFoodCultivation, previewBeastFeeding } from './feeding';
import { generateCapturedBeast } from './generator';
import { gainBeastExp, nextBeastExp } from './progression';
import { beastPanel } from './projection';
import { refineBeast } from './refinement';
import { BEAST_REFINEMENT } from './refinement-config';

const id = '00000000-0000-4000-8000-000000000001';
const born = () => generateCapturedBeast(id, id, BEAST_SPECIES[0].id, 0, 42);
function pill(
  appearance: 'low' | 'middle' | 'high' | 'perfect',
  fitMultiplier = 1,
): PillSpec {
  return {
    kind: 'pill',
    family: 'beast_cultivation',
    operations: resolveAlchemyEffects({
      quality: '神品',
      appearance,
      fitMultiplier,
      route: { effects: [{ key: 'beast_cultivation', weight: 1 }] },
    }).operations,
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: [],
      stability: 70,
      toxicityRating: 0,
      tags: [],
      appearance,
      version: 4,
    },
  };
}

describe('灵兽修为养成与喂养', () => {
  it('累计预算与逐级成长一致，保留主人等级上限', () => {
    const total = Array.from({ length: 180 }, (_, level) =>
      nextBeastExp(level),
    ).reduce((a, b) => a + b, 0);
    expect(total).toBe(1304070);
    expect(gainBeastExp(born(), total - 1, 180).level).toBe(179);
    expect(gainBeastExp(born(), total, 180)).toMatchObject({
      level: 180,
      exp: 0,
      unallocatedPoints: 900,
    });
    expect(gainBeastExp(born(), total, 35)).toMatchObject({
      level: 35,
      exp: 0,
      unallocatedPoints: 175,
    });
  });
  it.each([
    ['low', 67500],
    ['middle', 75000],
    ['high', 82500],
    ['perfect', 97500],
  ] as const)('沿用%s品相统一倍率，喂养不二次增幅', (appearance, value) => {
    const spec = pill(appearance);
    expect(beastFoodCultivation(spec)).toBe(value);
    const fed = previewBeastFeeding(born(), spec, 1, 180);
    expect(fed.gained).toBe(value);
    expect(fed.beast).toEqual(gainBeastExp(born(), value, 180));
  });
  it('神品中品丹约18颗升满，拒绝多余整颗并预览最后一颗损耗', () => {
    expect(
      previewBeastFeeding(born(), pill('middle'), 17, 180).beast.level,
    ).toBeLessThan(180);
    expect(previewBeastFeeding(born(), pill('middle'), 18, 180)).toMatchObject({
      beast: { level: 180 },
      gained: 1304070,
      wasted: 45930,
      maxQuantity: 18,
    });
    expect(() => previewBeastFeeding(born(), pill('middle'), 19, 180)).toThrow(
      '最多需要18颗',
    );
    const capped = gainBeastExp(born(), 100000, 10);
    expect(() => previewBeastFeeding(capped, pill('middle'), 1, 10)).toThrow(
      '等级上限',
    );
  });
  it('灵果按品质基础值80%产出，契合倍率仍由统一炼丹公式计算', () => {
    expect(
      beastFoodCultivation(
        buildSpiritFruitSpec({ family: 'beast_cultivation', quality: '神品' }),
      ),
    ).toBe(60000);
    expect(
      beastFoodCultivation(
        buildSpiritFruitSpec({ family: 'beast_cultivation', quality: '凡品' }),
      ),
    ).toBe(470);
    expect(beastFoodCultivation(pill('perfect', 1.15))).toBe(112125);
  });
  it('拒绝人物药效、异常数值与无效数量', () => {
    expect(
      beastFoodCultivation(
        buildSpiritFruitSpec({ family: 'cultivation', quality: '神品' }),
      ),
    ).toBe(0);
    for (const value of [NaN, Infinity, -1, 0, 1.5, 112126]) {
      expect(
        beastFoodCultivation({
          ...pill('middle'),
          operations: [{ type: 'gain_beast_cultivation', value }],
        }),
      ).toBe(0);
    }
    for (const quantity of [0, -1, 1.5, 100, NaN])
      expect(() =>
        previewBeastFeeding(born(), pill('middle'), quantity, 180),
      ).toThrow('数量');
  });
  it('归元为0级，清除加点，五项基础属性均从10点投影', () => {
    const grown = gainBeastExp(born(), 10000, 180);
    const reset = refineBeast(grown, BEAST_REFINEMENT.items[0].id, 180, 42);
    expect(reset).toMatchObject({ level: 0, exp: 0, unallocatedPoints: 0 });
    expect(Object.values(reset.allocatedAttributes)).toEqual([0, 0, 0, 0, 0]);
    expect(beastPanel(reset)).toEqual(beastPanel(born()));
    expect(beastPanel(reset).maxHp).toBe(Math.floor(10 * reset.growth * 7));
  });
});
