import type { Cultivator } from '@/types/cultivator';
import { FateEngine } from './FateEngine';

const swordCultivator: Cultivator = {
  id: 'c1',
  name: '韩立',
  gender: '男',
  realm: '炼气',
  realm_stage: '初期',
  age: 18,
  lifespan: 100,
  status: 'active',
  attributes: {
    vitality: 20,
    spirit: 18,
    wisdom: 22,
    speed: 19,
    willpower: 21,
  },
  spiritual_roots: [
    { element: '金', strength: 82, grade: '真灵根' },
    { element: '木', strength: 40, grade: '伪灵根' },
  ],
  pre_heaven_fates: [],
  cultivations: [],
  skills: [],
  inventory: {
    artifacts: [],
    consumables: [],
    materials: [],
  },
  equipped: {
    weapon: null,
    armor: null,
    accessory: null,
  },
  max_skills: 4,
  spirit_stones: 0,
  prompt: '寒门剑修，想走极致锋锐之道',
};

describe('FateEngine', () => {
  it('generates a six-slot candidate pool and preserves tradeoffs', () => {
    const pool = FateEngine.generateCandidatePool(
      swordCultivator,
      () => 0,
    );

    expect(pool).toHaveLength(6);
    expect(new Set(pool.map((fate) => fate.name)).size).toBe(6);
    expect(pool.some((fate) => fate.name === '先天剑修圣体')).toBe(true);
    expect(
      pool.every(
        (fate) => (fate.tradeoffs?.length ?? 0) > 0 && (fate.tags?.length ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it('evaluates creation bias and suppression together', () => {
    const context = FateEngine.evaluateCreationContext([
      { name: '先天剑修圣体' },
      { name: '青木丹心' },
    ]);

    expect(context.dominantTags).toContain('Material.Semantic.Blade');
    expect(context.dominantTags).toContain('Material.Semantic.Alchemy');
    expect(context.suppressedTags).toContain('Material.Semantic.Sustain');
    expect(context.summary).toContain('先天剑修圣体');
    expect(context.summary).toContain('青木丹心');
  });
});
