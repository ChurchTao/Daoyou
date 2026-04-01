import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { AffixPoolBuilder } from '@/engine/creation-v2/affixes/AffixPoolBuilder';
import { AffixSelector } from '@/engine/creation-v2/affixes/AffixSelector';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { AttributeType, GameplayTags, ModifierType } from '@/engine/creation-v2/contracts/battle';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import { AffixCandidate, EnergyBudget, CreationIntent } from '@/engine/creation-v2/types';

// ─── AffixEffectTranslator ───────────────────────────────────────────────────

describe('AffixEffectTranslator', () => {
  const translator = new AffixEffectTranslator();

  it('resolveParam: ScalableValueV2 quality 缩放', () => {
    const scaled = { base: 10, scale: 'quality' as const, coefficient: 5 };
    // 凡品 → qualityOrder=0 → 10 + 0*5 = 10
    expect(translator.resolveParam(scaled, 0)).toBe(10);
    // 真品 → qualityOrder=3 → 10 + 3*5 = 25
    expect(translator.resolveParam(scaled, 3)).toBe(25);
    // 天品 → qualityOrder=5 → 10 + 5*5 = 35
    expect(translator.resolveParam(scaled, 5)).toBe(35);
  });

  it('resolveParam: scale=none 忽略品质', () => {
    const scaled = { base: 10, scale: 'none' as const, coefficient: 5 };
    expect(translator.resolveParam(scaled, 7)).toBe(10);
  });

  it('resolveParam: 直接数字原样返回', () => {
    expect(translator.resolveParam(42, 7)).toBe(42);
  });

  it('translate: damage 效果品质缩放 base 正确', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-damage')!;
    expect(def).toBeDefined();

    const resultFan = translator.translate(def, '凡品');
    expect(resultFan.type).toBe('damage');
    if (resultFan.type === 'damage') {
      // base: { base:20, scale:quality, coefficient:8 } → 凡品 qualityOrder=0 → 20
      expect(resultFan.params.value.base).toBe(20);
      expect(resultFan.params.value.coefficient).toBe(0.5);
    }

    const resultZhen = translator.translate(def, '真品');
    if (resultZhen.type === 'damage') {
      // 真品 qualityOrder=3 → 20 + 3*8 = 44
      expect(resultZhen.params.value.base).toBe(44);
    }
  });

  it('translate: attribute_stat_buff 生成 apply_buff with modifiers', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-spirit')!;
    expect(def).toBeDefined();

    const result = translator.translate(def, '凡品');
    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      const { buffConfig } = result.params;
      expect(buffConfig.duration).toBe(-1);
      expect(buffConfig.stackRule).toBe('ignore');
      expect(buffConfig.modifiers).toHaveLength(1);
      expect(buffConfig.modifiers![0].attrType).toBe(AttributeType.SPIRIT);
      expect(buffConfig.modifiers![0].type).toBe(ModifierType.FIXED);
      // 凡品 qualityOrder=0 → base=5 + 0*2=5
      expect(buffConfig.modifiers![0].value).toBe(5);
    }

    const resultZhen = translator.translate(def, '真品');
    if (resultZhen.type === 'apply_buff') {
      // 真品 qualityOrder=3 → 5 + 3*2=11
      expect(resultZhen.params.buffConfig.modifiers![0].value).toBe(11);
    }
  });

  it('translate: percent_damage_modifier mode 和 value 正确', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-prefix-crit-boost')!;
    const result = translator.translate(def, '凡品');
    expect(result.type).toBe('percent_damage_modifier');
    if (result.type === 'percent_damage_modifier') {
      expect(result.params.mode).toBe('increase');
      // 凡品: 0.12 + 0*0.03 = 0.12
      expect(result.params.value).toBeCloseTo(0.12);
    }
  });

  it('translate: damage_immunity 应保留 battle-v5 标签参数', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-signature-spellward')!;
    const result = translator.translate(def, '真品');
    expect(result.type).toBe('damage_immunity');
    if (result.type === 'damage_immunity') {
      expect(result.params.tags).toEqual([GameplayTags.ABILITY.TYPE_MAGIC]);
    }
  });

  it('translate: buff_immunity 应保留 battle-v5 标签参数', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-signature-unbound-mind')!;
    const result = translator.translate(def, '玄品');
    expect(result.type).toBe('buff_immunity');
    if (result.type === 'buff_immunity') {
      expect(result.params.tags).toEqual([GameplayTags.BUFF.TYPE_CONTROL]);
    }
  });

  it('translate: death_prevent 应生成原子免死效果', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-signature-last-stand')!;
    const result = translator.translate(def, '地品');
    expect(result.type).toBe('death_prevent');
  });
});

// ─── AffixSelector ──────────────────────────────────────────────────────────

describe('AffixSelector', () => {
  const selector = new AffixSelector();

  const makeCandidate = (
    id: string,
    weight: number,
    energyCost: number,
    exclusiveGroup?: string,
  ): AffixCandidate => ({
    id,
    name: id,
    category: 'core',
    tags: [],
    weight,
    energyCost,
    exclusiveGroup,
  });

  const makeIntent = (): CreationIntent => ({
    productType: 'skill',
    outcomeKind: 'active_skill',
    dominantTags: [],
    requestedTags: [],
  });

  const makeBudget = (remaining: number): EnergyBudget => ({
    total: remaining + 4,
    reserved: 4,
    spent: 0,
    remaining,
    allocations: [],
    sources: [],
  });

  it('预算耗尽时停止追加词缀', () => {
    const pool = [
      makeCandidate('a', 100, 10),
      makeCandidate('b', 100, 10),
      makeCandidate('c', 100, 10),
    ];
    // remaining = 15, 每个 energyCost=10 → 最多选1个（选完还剩5，不够第二个）
    const result = selector.select(pool, makeBudget(15), makeIntent());
    expect(result.affixes).toHaveLength(1);
    expect(result.exhaustionReason).toBe('budget_exhausted');
  });

  it('同 exclusiveGroup 只选一个', () => {
    const pool = [
      makeCandidate('a', 100, 5, 'grp'),
      makeCandidate('b', 100, 5, 'grp'),
      makeCandidate('c', 100, 5), // 无 exclusiveGroup
    ];
    // 三个都能选，但 grp 只能选一个，所以最多选 2 个
    const result = selector.select(pool, makeBudget(50), makeIntent());
    expect(result.affixes).toHaveLength(2);
    const grpPicked = result.affixes.filter((r) => r.exclusiveGroup === 'grp');
    expect(grpPicked).toHaveLength(1);
    expect(
      result.rejections.some(
        (rejection) => rejection.reason === 'exclusive_group_conflict',
      ),
    ).toBe(true);
  });

  it('rollScore 等于 weight/totalWeight', () => {
    // 固定权重，确保 rollScore 计算正确
    const pool = [makeCandidate('only', 100, 5)];
    const result = selector.select(pool, makeBudget(10), makeIntent(), 1);
    expect(result.affixes).toHaveLength(1);
    // 只有一个候选，rollScore 应为 1.0
    expect(result.affixes[0].rollScore).toBeCloseTo(1.0);
  });

  it('空候选池返回空数组', () => {
    expect(selector.select([], makeBudget(50), makeIntent()).affixes).toEqual([]);
  });
});

// ─── DEFAULT_AFFIX_REGISTRY ─────────────────────────────────────────────────

describe('DEFAULT_AFFIX_REGISTRY', () => {
  it('包含技能、法宝、功法词缀', () => {
    const skillDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Blade'],
      ['core', 'prefix', 'suffix', 'signature'],
      'skill',
    );
    expect(skillDefs.length).toBeGreaterThan(0);

    const artifactDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Type.Ore'],
      ['core', 'prefix', 'suffix', 'signature'],
      'artifact',
    );
    expect(artifactDefs.length).toBeGreaterThan(0);

    const gongfaDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Spirit'],
      ['core', 'prefix', 'suffix', 'signature'],
      'gongfa',
    );
    expect(gongfaDefs.length).toBeGreaterThan(0);
  });

  it('OR 语义：仅一条 tag 匹配即可', () => {
    const defs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Flame'], // 只传这一条
      ['core', 'suffix'],
      'skill',
    );
    // skill-core-damage-fire 和 skill-suffix-burn 均应命中
    const ids = defs.map((d) => d.id);
    expect(ids).toContain('skill-core-damage-fire');
    expect(ids).toContain('skill-suffix-burn');
  });

  it('未解锁类别的词缀不出现', () => {
    const defs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Manual', 'Material.Semantic.Spirit'],
      ['core'], // 未解锁 signature
      'gongfa',
    );
    const ids = defs.map((d) => d.id);
    expect(ids).not.toContain('gongfa-signature-comprehension');
  });

  it('minQuality 过滤：玄品以下不应出现 gongfa-signature-comprehension', () => {
    // 该签名词缀 minQuality = 玄品 (order=2)，凡品 (order=0) 不应通过
    // 这里通过 AffixPoolBuilder 来测试 quality 过滤
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'gongfa',
      materials: [
        { name: '凡品灵草', type: 'herb', rank: '凡品', quantity: 1, element: undefined, description: '灵草' },
      ],
    });
    // 手动设置 session 状态
    session.state.materialFingerprints = [{ rank: '凡品', energyValue: 8, rarityWeight: 1, explicitTags: [], semanticTags: ['Material.Semantic.Spirit'], recipeTags: [], materialName: '凡品灵草', materialType: 'herb', quantity: 1 }];
    session.state.recipeMatch = { recipeId: 'default', valid: true, matchedTags: [], unlockedAffixCategories: ['core', 'prefix', 'suffix', 'signature'] };
    session.state.tags = ['Material.Semantic.Spirit', 'Material.Semantic.Manual'];
    const pool = builder.build(DEFAULT_AFFIX_REGISTRY, session);
    const ids = pool.map((c: AffixCandidate) => c.id);
    expect(ids).not.toContain('gongfa-signature-comprehension');
  });
});
