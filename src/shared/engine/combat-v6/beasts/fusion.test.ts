import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateWildIndividual } from '../wild/generator';
import { BEAST_SKILLS, BEAST_SPECIES } from './content';
import fusionSchema from './data/fusion.schema.json';
import { beastFusionReason, fuseBeasts, fusionPreview } from './fusion';
import { BEAST_FUSION, BeastFusionConfigSchema } from './fusion-config';
import { generateStarterBeast } from './generator';
import { beastPointBudget } from './identity';
import { gainBeastExp } from './progression';
import { beastAttributes } from './projection';
import { BeastSchema, GeneratedBeastSchema } from './schema';

const owner = '00000000-0000-4000-8000-000000000001';
const ids = [
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];
const pair = () =>
  ids
    .slice(0, 2)
    .map((id, i) =>
      gainBeastExp(
        generateStarterBeast(id, owner, BEAST_SPECIES[i].id, i),
        100000,
        30,
      ),
    );
const lineage = { carriedBeastIds: [], revision: 0 };

describe('融合与宝宝身份', () => {
  it('历史材料点数不足不阻断融合，结果按新身份重建并校验点数', () => {
    const [a, b] = pair().map((beast) => ({
      ...beast,
      unallocatedPoints: beast.unallocatedPoints - 50,
    }));
    const before = structuredClone([a, b]);
    const result = fuseBeasts(a, b, ids[2], 42);
    expect(GeneratedBeastSchema.parse(result)).toEqual(result);
    expect([a, b]).toEqual(before);
  });
  it('多代筛选回炉保持独立点数预算与融合上限，不累积属性加点', () => {
    let [a, b] = pair();
    for (let generation = 0; generation < 20; generation++) {
      const resultId = a.id === ids[0] ? ids[2] : ids[0];
      const candidates = Array.from({ length: 24 }, (_, sample) =>
        fuseBeasts(a, b, resultId, generation * 24 + sample),
      );
      const best = candidates.sort(
        (x, y) => y.aptitudes.attack - x.aptitudes.attack,
      )[0];
      expect(best.growth).toBeLessThanOrEqual(1.3);
      for (const key of Object.keys(
        best.aptitudes,
      ) as (keyof typeof best.aptitudes)[]) {
        expect(best.aptitudes[key]).toBeGreaterThanOrEqual(1);
        expect(best.aptitudes[key]).toBeLessThanOrEqual(
          BEAST_FUSION.aptitudeCaps[key],
        );
      }
      expect(
        Object.values(best.allocatedAttributes).reduce(
          (sum, v) => sum + v,
          best.unallocatedPoints,
        ),
      ).toBe(beastPointBudget(best));
      a = gainBeastExp(best, 100000, 30);
      b = gainBeastExp({ ...best, id: ids[1] }, 100000, 30);
    }
  });
  it('配置编辑器与运行时一致，权重与概率不能越界', () => {
    expect(fusionSchema).toEqual(z.toJSONSchema(BeastFusionConfigSchema));
    expect(
      BeastFusionConfigSchema.safeParse({ ...BEAST_FUSION, babyChance: 1.1 })
        .success,
    ).toBe(false);
    expect(
      BeastFusionConfigSchema.safeParse({
        ...BEAST_FUSION,
        aptitudeWeights: [{ value: 100, weight: 99 }],
      }).success,
    ).toBe(false);
    expect(
      BEAST_FUSION.aptitudeWeights.reduce(
        (sum, row) => sum + (row.value * row.weight) / 100,
        0,
      ),
    ).toBeCloseTo(97.44);
    expect(
      BEAST_FUSION.growthWeights.reduce(
        (sum, row) => sum + (row.value * row.weight) / 100,
        0,
      ),
    ).toBeCloseTo(99.4);
  });
  it('30级野生总点数290，出生亏损固定，后续升级恢复正常增量', () => {
    const wild = generateWildIndividual(
      { unitId: 'enemy', speciesId: BEAST_SPECIES[0].id, level: 30 },
      ids[0],
      owner,
      42,
    ).beast;
    const total = (b: typeof wild) =>
      Object.values(beastAttributes(b)).reduce(
        (sum, value) => sum + value,
        b.unallocatedPoints,
      );
    expect(wild.unallocatedPoints).toBe(0);
    expect(total(wild)).toBe(290);
    const grown = gainBeastExp(wild, 100000, 40);
    expect(grown.level).toBe(40);
    expect(grown.initialLevel).toBe(30);
    expect(total(grown)).toBe(390);
    expect(grown.unallocatedPoints).toBe(50);
  });
  it('共有技能只按50%继承一次，改动资质不会扰动技能与身份', () => {
    const species = BEAST_SPECIES.find((s) => !s.birthSkills.core.length)!;
    const [a, b] = pair().map((v) => ({
      ...v,
      speciesId: species.id,
      skills: ['beast.combo', 'beast.advanced-combo'],
      skillSlotCapacity: 2,
    }));
    let combo = 0,
      both = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const result = fuseBeasts(a, b, ids[2], seed);
      const once = fuseBeasts(
        a,
        { ...b, skills: [], skillSlotCapacity: 0, growth: 0.5 },
        ids[2],
        seed,
      );
      expect(result.skills).toEqual(once.skills);
      expect(result.originKind).toBe(once.originKind);
      combo += Number(result.skills.includes('beast.combo'));
      both += Number(result.skills.length === 2);
    }
    expect(combo / 3000).toBeCloseTo(0.5, 1);
    expect(both / 3000).toBeCloseTo(0.25, 1);
  });
  it('宝宝和变异的初始自由点与基础点分别计入，不重复计点', () => {
    const [base] = pair();
    for (const [originKind, isMutant, total] of [
      ['baby', false, 100],
      ['pseudo_baby', false, 50],
      ['baby', true, 150],
    ] as const) {
      const b = BeastSchema.parse({
        ...base,
        originKind,
        isMutant,
        level: 0,
        initialLevel: 0,
        unallocatedPoints: originKind === 'baby' ? 50 : 0,
      });
      expect(
        Object.values(beastAttributes(b)).reduce((s, v) => s + v, 0) +
          b.unallocatedPoints,
      ).toBe(total);
    }
    expect(
      BeastSchema.safeParse({ ...base, originKind: 'wild', isMutant: true })
        .success,
    ).toBe(false);
  });
  it('禁止重复材料、变异、低等级、编组占用和主人门槛', () => {
    const [a, b] = pair();
    expect(beastFusionReason(a, a, 180, lineage)).toContain('两只');
    expect(
      beastFusionReason({ ...a, isMutant: true }, b, 180, lineage),
    ).toContain('变异');
    expect(beastFusionReason({ ...a, level: 29 }, b, 180, lineage)).toContain(
      '30',
    );
    expect(
      beastFusionReason(a, b, 180, { ...lineage, carriedBeastIds: [a.id] }),
    ).toContain('编组');
    expect(beastFusionReason(a, b, 10, lineage)).toBeTruthy();
  });
  it('物种只来自双方，身份概率遵循95/5和25/75，交换材料结果不变', () => {
    const [a, b] = pair();
    for (const kinds of [
      ['baby', 'baby'],
      ['baby', 'pseudo_baby'],
      ['baby', 'wild'],
      ['pseudo_baby', 'pseudo_baby'],
      ['pseudo_baby', 'wild'],
      ['wild', 'wild'],
    ] as const) {
      const inputs = [a, b].map((v, i) => {
        const next = { ...v, originKind: kinds[i] };
        return BeastSchema.parse({
          ...next,
          unallocatedPoints: beastPointBudget(next),
        });
      });
      const counts = { baby: 0, pseudo_baby: 0, wild: 0 };
      for (let seed = 0; seed < 2000; seed++) {
        const next = fuseBeasts(inputs[0], inputs[1], ids[2], seed);
        expect([a.speciesId, b.speciesId]).toContain(next.speciesId);
        expect(next).toEqual(fuseBeasts(inputs[1], inputs[0], ids[2], seed));
        counts[next.originKind]++;
        expect(BeastSchema.safeParse(next).success).toBe(true);
      }
      if (kinds.every((k) => k === 'baby')) {
        expect(counts.wild).toBe(0);
        expect(counts.baby / 2000).toBeCloseTo(0.95, 1);
      } else {
        expect(counts.baby).toBe(0);
        expect(counts.pseudo_baby / 2000).toBeCloseTo(0.25, 1);
      }
    }
  });
  it('恢复结果必带，共有技能只抽一次，不裁剪8或16格', () => {
    const [a, b] = pair().map((v) => ({
      ...v,
      skills: BEAST_SKILLS.map((s) => s.id),
      skillSlotCapacity: BEAST_SKILLS.length,
    }));
    const results = Array.from({ length: 50 }, (_, seed) =>
      fuseBeasts(a, b, ids[2], seed),
    );
    expect(results.some((v) => v.skills.length > 16)).toBe(true);
    for (const next of results) {
      expect(next.skills).toEqual(
        expect.arrayContaining(
          BEAST_SPECIES.find((s) => s.id === next.speciesId)!.birthSkills.core,
        ),
      );
      expect(new Set(next.skills).size).toBe(next.skills.length);
      expect(next.skillSlotCapacity).toBe(next.skills.length);
    }
    expect(
      fusionPreview(a, b).every((v) => v.maxSkills === BEAST_SKILLS.length),
    ).toBe(true);
  });
  it('无必带的零技能材料可产生零格，独立数值始终在融合边界内', () => {
    const species = BEAST_SPECIES.find((s) => !s.birthSkills.core.length)!;
    const [a, b] = pair().map((v) => ({
      ...v,
      speciesId: species.id,
      skills: [],
      skillSlotCapacity: 0,
      growth: 3,
      aptitudes: {
        attack: 99999,
        defense: 99999,
        health: 99999,
        mana: 99999,
        speed: 99999,
      },
    }));
    for (let seed = 0; seed < 30; seed++) {
      const next = fuseBeasts(a, b, ids[2], seed);
      expect(next.skills).toEqual([]);
      expect(next.growth).toBe(1.3);
      expect(next.aptitudes).toEqual(BEAST_FUSION.aptitudeCaps);
    }
  });
});
