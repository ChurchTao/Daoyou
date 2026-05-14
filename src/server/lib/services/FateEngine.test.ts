import type { Cultivator, PreHeavenFate } from '@shared/types/cultivator';
import { FATE_QUALITY_TEMPLATES } from './FateConfig';
import { FateEngine } from './FateEngine';
import { QUALITY_ORDER } from '@shared/types/constants';

const buildCultivator = (
  overrides: Partial<Cultivator> = {},
): Cultivator => ({
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
  ...overrides,
});

describe('FateEngine', () => {
  const previousDisable = process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING = 'true';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING = previousDisable;
  });

  it('root_restricted 下无金灵根不会抽到剑修核心命格', async () => {
    const pool = await FateEngine.generateCandidatePool(
      buildCultivator({
        spiritual_roots: [{ element: '木', strength: 88, grade: '真灵根' }],
        prompt: '草木之气浓厚，想走丹药与温养一路',
      }),
      { rng: () => 0, strategy: 'root_restricted' },
    );

    expect(pool).toHaveLength(6);
    expect(
      pool.some(
        (fate) => fate.generationModel?.coreKey === 'core_sword_bone',
      ),
    ).toBe(false);
  });

  it('fully_random 下同条件仍可抽到被灵根限制的核心命格', async () => {
    const pool = await FateEngine.generateCandidatePool(
      buildCultivator({
        spiritual_roots: [{ element: '木', strength: 88, grade: '真灵根' }],
        prompt: '草木修士',
      }),
      { rng: () => 0, strategy: 'fully_random' },
    );

    expect(
      pool.some(
        (fate) => fate.generationModel?.coreKey === 'core_sword_bone',
      ),
    ).toBe(true);
  });

  it('各品质命格遵守 boon/burden/rare 模板数量', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: () => 0,
      strategy: 'root_restricted',
    });

    for (const fate of pool) {
      const quality = fate.quality ?? '凡品';
      const template = FATE_QUALITY_TEMPLATES[quality];
      const effects = fate.effects ?? [];
      const boonCount = effects.filter((effect) => effect.polarity === 'boon').length;
      const burdenCount = effects.filter((effect) => effect.polarity === 'burden').length;
      const rareCount = effects.filter((effect) =>
        effect.fragmentId.startsWith('rare_'),
      ).length;

      expect(boonCount).toBe(template.boonCount + rareCount);
      expect(burdenCount).toBe(template.burdenCount);
      if (!template.rareOptional) {
        expect(rareCount).toBe(template.rareCount);
      } else {
        expect(rareCount).toBeLessThanOrEqual(template.rareCount);
      }
    }
  });

  it('高品质命格不会被强制扩成三域全覆盖', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: () => 0,
      strategy: 'root_restricted',
    });
    const highQualityFates = pool.filter(
      (fate) =>
        QUALITY_ORDER[fate.quality ?? '凡品'] >= QUALITY_ORDER['天品'],
    );

    expect(highQualityFates.length).toBeGreaterThan(0);
    expect(
      highQualityFates.every((fate) => {
        const positiveScopes = new Set(
          (fate.effects ?? [])
            .filter((effect) => effect.polarity === 'boon')
            .map((effect) => effect.scope),
        );
        return positiveScopes.size <= 2;
      }),
    ).toBe(true);
  });

  it('从 effects 聚合正负造物偏置', () => {
    const context = FateEngine.evaluateCreationContext([
      {
        name: '剑锋命',
        effects: [
          {
            id: '1',
            fragmentId: 'boon_blade_resonance',
            scope: 'creation',
            polarity: 'boon',
            effectType: 'creation_tag_bias',
            value: 0.6,
            tags: ['Material.Semantic.Blade'],
            label: '造物更易引出【锋刃】词缀（强）',
            description: '造物更易引出【锋刃】词缀（强）',
            extreme: 'strong',
          },
          {
            id: '2',
            fragmentId: 'burden_avoid_sustain',
            scope: 'creation',
            polarity: 'burden',
            effectType: 'creation_tag_bias',
            value: 0.4,
            tags: ['Material.Semantic.Sustain'],
            label: '造物更难圆融【疗养】词缀（强）',
            description: '造物更难圆融【疗养】词缀（强）',
            extreme: 'strong',
          },
        ],
      } as PreHeavenFate,
      {
        name: '丹心骨',
        effects: [
          {
            id: '3',
            fragmentId: 'boon_alchemy_resonance',
            scope: 'creation',
            polarity: 'boon',
            effectType: 'creation_tag_bias',
            value: 0.55,
            tags: ['Material.Semantic.Alchemy'],
            label: '造物更易引出【丹道】词缀（强）',
            description: '造物更易引出【丹道】词缀（强）',
            extreme: 'strong',
          },
        ],
      } as PreHeavenFate,
    ]);

    expect(context.positiveTagBiases.map((bias) => bias.tag)).toContain(
      'Material.Semantic.Blade',
    );
    expect(context.positiveTagBiases.map((bias) => bias.tag)).toContain(
      'Material.Semantic.Alchemy',
    );
    expect(context.negativeTagBiases.map((bias) => bias.tag)).toContain(
      'Material.Semantic.Sustain',
    );
    expect(context.summary).toContain('剑锋命');
    expect(context.summary).toContain('丹心骨');
  });
});
