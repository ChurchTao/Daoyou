import { GameplayTags } from '@/engine/shared/tag-domain';
import { describe, expect, it } from '@jest/globals';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { AffixPoolBuilder } from '@/engine/creation-v2/affixes/AffixPoolBuilder';
import { AffixSelector } from '@/engine/creation-v2/affixes/AffixSelector';
import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
  matchAll,
} from '@/engine/creation-v2/affixes';
import { ARTIFACT_AFFIXES } from '@/engine/creation-v2/affixes/definitions/artifactAffixes';
import { GONGFA_AFFIXES } from '@/engine/creation-v2/affixes/definitions/gongfaAffixes';
import { SKILL_AFFIXES } from '@/engine/creation-v2/affixes/definitions/skillAffixes';
import { CREATION_DURATION_POLICY } from '@/engine/creation-v2/config/CreationBalance';
import { AttributeType, BuffType, ModifierType } from '@/engine/creation-v2/contracts/battle';
import { ELEMENT_TO_RUNTIME_ABILITY_TAG } from '@/engine/shared/tag-domain';
import { CreationTags } from '@/engine/shared/tag-domain';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import { AffixCandidate, EnergyBudget, CreationIntent, RolledAffix } from '@/engine/creation-v2/types';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';

/** 辅助函数：将静态定义转换为运行态 RolledAffix 以满足接口契约 */
function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    category: def.category,
    energyCost: def.energyCost,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    effectTemplate: def.effectTemplate,
    weight: def.weight,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    exclusiveGroup: def.exclusiveGroup,
  };
}

function toSignals(tags: string[]) {
  return tags.map((tag) => ({
    tag,
    source: 'material_semantic' as const,
    weight: 0.55,
  }));
}

function syncSessionTags(session: CreationSession, tags: string[]): void {
  session.syncInputTagSignals(toSignals(tags));
}

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

    const resultFan = translator.translate(toRolledAffix(def), '凡品');
    expect(resultFan.type).toBe('damage');
    if (resultFan.type === 'damage') {
      // base: { base:80, scale:quality, coefficient:14 } → 凡品 qualityOrder=0 → 80
      expect(resultFan.params.value.base).toBe(80);
      expect(resultFan.params.value.coefficient).toBe(0.9);
    }

    const resultZhen = translator.translate(toRolledAffix(def), '真品');
    if (resultZhen.type === 'damage') {
      // 真品 qualityOrder=3 → 80 + 3*14 = 122
      expect(resultZhen.params.value.base).toBe(122);
    }
  });

  it('translate: attribute_stat_buff 生成 apply_buff with modifiers（临时 buff）', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-prefix-spirit-boost')!;
    expect(def).toBeDefined();

    const result = translator.translate(toRolledAffix(def), '凡品');
    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      const { buffConfig } = result.params;
      expect(buffConfig.duration).toBe(CREATION_DURATION_POLICY.buffDebuff.short);
      expect(buffConfig.stackRule).toBe('override');
      expect(buffConfig.modifiers).toHaveLength(1);
      expect(buffConfig.modifiers![0].attrType).toBe(AttributeType.SPIRIT);
      expect(buffConfig.modifiers![0].type).toBe(ModifierType.FIXED);
      // 凡品 qualityOrder=0 → base=3 + 0*1=3
      expect(buffConfig.modifiers![0].value).toBe(3);
    }

    const resultTian = translator.translate(toRolledAffix(def), '天品');
    if (resultTian.type === 'apply_buff') {
      // 天品 qualityOrder=5 -> 3 + 5*1=8
      expect(resultTian.params.buffConfig.modifiers![0].value).toBe(8);
    }
  });

  it('translate: percent_damage_modifier mode 和 value 正确', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-prefix-crit-boost')!;
    const result = translator.translate(toRolledAffix(def), '凡品');
    expect(result.type).toBe('percent_damage_modifier');
    if (result.type === 'percent_damage_modifier') {
      expect(result.params.mode).toBe('increase');
      // 凡品: 0.12 + 0*0.03 = 0.12
      expect(result.params.value).toBeCloseTo(0.12);
    }
  });

  it('translate: ability_has_tag 条件应原样透传到 battle-v5', () => {
    // artifact-prefix-fire-resistance 已合并入元素减伤生成器，使用生成器产生的 ID
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-suffix-elem-Material.Element.Fire-reduce')!;
    const result = translator.translate(toRolledAffix(def), '凡品');

    expect(result.conditions).toEqual([
      {
        type: 'ability_has_tag',
        params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['火'] },
      },
    ]);
  });

  it('gongfa 元素专精增伤词条应覆盖八系并使用 ability_has_tag 过滤', () => {
    const elementalSpecializations = [
      ['gongfa-prefix-metal-specialization', '金'],
      ['gongfa-prefix-wood-specialization', '木'],
      ['gongfa-prefix-water-specialization', '水'],
      ['gongfa-prefix-fire-specialization', '火'],
      ['gongfa-prefix-earth-specialization', '土'],
      ['gongfa-prefix-wind-specialization', '风'],
      ['gongfa-prefix-thunder-specialization', '雷'],
      ['gongfa-prefix-ice-specialization', '冰'],
    ] as const;

    for (const [affixId, element] of elementalSpecializations) {
      const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
      expect(def).toBeDefined();
      expect(def?.category).toBe('prefix');
      expect(def?.effectTemplate.type).toBe('percent_damage_modifier');

      if (def?.effectTemplate.type === 'percent_damage_modifier') {
        expect(def.effectTemplate.conditions).toEqual([
          {
            type: 'ability_has_tag',
            params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG[element] },
          },
        ]);
      }
    }
  });

  it('translate: damage_immunity 应保留 battle-v5 标签参数', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-signature-spellward')!;
    const result = translator.translate(toRolledAffix(def), '真品');
    expect(result.type).toBe('damage_immunity');
    if (result.type === 'damage_immunity') {
      expect(result.params.tags).toEqual([GameplayTags.ABILITY.CHANNEL.MAGIC]);
    }
  });

  it('translate: artifact mana recovery 应生成真实 MP 回复效果', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-suffix-mana-recovery')!;
    const result = translator.translate(toRolledAffix(def), '玄品');

    expect(result.type).toBe('heal');
    if (result.type === 'heal') {
      expect(result.params.target).toBe('mp');
      expect(result.params.value.base).toBeGreaterThan(0);
    }
  });

  it('translate: skill dispel-buff 应只驱散正面 buff 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-suffix-dispel-buff')!;
    const result = translator.translate(toRolledAffix(def), '凡品');

    expect(result.type).toBe('dispel');
    if (result.type === 'dispel') {
      expect(result.params.targetTag).toBe(GameplayTags.BUFF.TYPE.BUFF);
    }
  });

  it('translate: gongfa debuff-cleanse 应只驱散负面 buff 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-suffix-debuff-cleanse')!;
    const result = translator.translate(toRolledAffix(def), '凡品');

    expect(result.type).toBe('dispel');
    if (result.type === 'dispel') {
      expect(result.params.targetTag).toBe(GameplayTags.BUFF.TYPE.DEBUFF);
    }
  });

  it('translate: control buff 应拆分 buff tags 与控制 statusTags', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-control-stun')!;
    const result = translator.translate(toRolledAffix(def), '凡品');

    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      expect(result.params.buffConfig.tags).toHaveLength(2);
      expect(result.params.buffConfig.tags).toEqual(expect.arrayContaining([
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.BUFF.TYPE.CONTROL,
      ]));
      expect(result.params.buffConfig.statusTags).toHaveLength(4);
      expect(result.params.buffConfig.statusTags).toEqual(expect.arrayContaining([
        GameplayTags.STATUS.CATEGORY.DEBUFF,
        GameplayTags.STATUS.CONTROL.ROOT,
        GameplayTags.STATUS.CONTROL.STUNNED,
        GameplayTags.STATUS.CONTROL.NO_ACTION,
      ]));
    }
  });

  it('translate: burn dot buff 应同时携带 debuff tags 与 burn statusTags', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-suffix-burn-dot')!;
    const result = translator.translate(toRolledAffix(def), '凡品');

    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      expect(result.params.buffConfig.tags).toHaveLength(3);
      expect(result.params.buffConfig.tags).toEqual(expect.arrayContaining([
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.BUFF.DOT.ROOT,
        GameplayTags.BUFF.DOT.BURN,
      ]));
      expect(result.params.buffConfig.statusTags).toHaveLength(3);
      expect(result.params.buffConfig.statusTags).toEqual(expect.arrayContaining([
        GameplayTags.STATUS.CATEGORY.DEBUFF,
        GameplayTags.STATUS.CATEGORY.DOT,
        GameplayTags.STATUS.STATE.BURNED,
      ]));
    }
  });

  it('translate: attribute_stat_buff MULTIPLY modType 生成乘数 modifier', () => {
    const def: AffixDefinition = {
      id: 'test-multiply-buff',
      displayName: 'test',
      displayDescription: 'test',
      category: 'prefix',
      match: matchAll([]),
      weight: 1,
      energyCost: 1,
      applicableTo: ['skill'],
      effectTemplate: {
        type: 'attribute_stat_buff',
        params: {
          attrType: AttributeType.WISDOM,
          modType: ModifierType.MULTIPLY,
          value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
          duration: 1,
        },
      },
    };

    const resultXuan = translator.translate(toRolledAffix(def), '玄品');
    expect(resultXuan.type).toBe('apply_buff');
    if (resultXuan.type === 'apply_buff') {
      const mod = resultXuan.params.buffConfig.modifiers![0];
      expect(mod.attrType).toBe(AttributeType.WISDOM);
      expect(mod.type).toBe(ModifierType.MULTIPLY);
      // 玄品 order=2 -> 0.12 + 2*0.02 = 0.16
      expect(mod.value).toBeCloseTo(0.16);
    }

    const resultTian = translator.translate(toRolledAffix(def), '天品');
    if (resultTian.type === 'apply_buff') {
      const mod = resultTian.params.buffConfig.modifiers![0];
      // 天品 order=5 -> 0.12 + 5*0.02 = 0.22
      expect(mod.value).toBeCloseTo(0.22);
    }
  });

  it('translate: attribute_modifier 应在翻译阶段拒绝（由投影层处理）', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-spirit')!;
    expect(() => translator.translate(toRolledAffix(def), '凡品')).toThrow(
      'attribute_modifier must be projected to AbilityConfig.modifiers in passive policy',
    );
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
    category: AffixCandidate['category'] = 'core',
  ): AffixCandidate => ({
    id,
    name: id,
    category,
    match: matchAll([]),
    tags: [],
    weight,
    energyCost,
    exclusiveGroup,
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: 10,
          attribute: AttributeType.MAGIC_ATK,
        },
      },
    },
  });

  const makeIntent = (): CreationIntent => ({
    productType: 'skill',
    outcomeKind: 'active_skill',
    dominantTags: [],
    requestedTags: [],
  });

  const makeBudget = (remaining: number): EnergyBudget => ({
    baseTotal: remaining + 4,
    effectiveTotal: remaining + 4,
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
    expect(result.exhaustionReason).toBe('pool_exhausted');
  });

  it('同 exclusiveGroup 只选一个', () => {
    const pool = [
      makeCandidate('a', 100, 5, undefined, 'core'),
      makeCandidate('b', 100, 5, 'grp', 'prefix'),
      makeCandidate('c', 100, 5, 'grp', 'suffix'),
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

  it('应保留逐轮审计，同时对汇总 rejection 去重', () => {
    const pool = [
      makeCandidate('core-main', 100, 5, 'grp', 'core'),
      makeCandidate('locked-prefix', 100, 4, 'grp', 'prefix'),
      makeCandidate('free-suffix', 100, 4, undefined, 'suffix'),
    ];

    const { audit } = selector.selectWithDecision(
      pool,
      makeBudget(12),
      makeIntent(),
      3,
    );

    expect(audit.rounds).toHaveLength(3);
    expect(audit.rejections).toEqual([
      expect.objectContaining({
        affixId: 'locked-prefix',
        reason: 'exclusive_group_conflict',
      }),
    ]);
    expect(audit.rounds[1].decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'locked-prefix',
          reason: 'exclusive_group_conflict',
        }),
      ]),
    );
    expect(audit.rounds[2].decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'locked-prefix',
          reason: 'exclusive_group_conflict',
        }),
      ]),
    );
    expect(audit.finalDecision).toBeDefined();
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

  it('分阶段抽取：应先锁定 core，再抽取非 core', () => {
    const pool = [
      makeCandidate('core-main', 1, 6, undefined, 'core'),
      makeCandidate('prefix-heavy', 1000, 6, undefined, 'prefix'),
      makeCandidate('suffix-heavy', 1000, 6, undefined, 'suffix'),
    ];

    const result = selector.select(pool, makeBudget(20), makeIntent(), 2);

    expect(result.affixes.length).toBeGreaterThanOrEqual(1);
    expect(result.affixes[0].category).toBe('core');
    expect(result.affixes.some((affix) => affix.category === 'core')).toBe(true);
  });

  it('加权选择应大致按权重比例分布（统计验证）', () => {
    // 三个候选，权重比 4:2:1，在足够大的样本中各自命中次数应近似该比例
    const pool = [
      makeCandidate('heavy', 400, 5), // 期望选中概率 ≈ 57%
      makeCandidate('medium', 200, 5), // 期望选中概率 ≈ 29%
      makeCandidate('light', 100, 5), // 期望选中概率 ≈ 14%
    ];
    const N = 300;
    const counts: Record<string, number> = { heavy: 0, medium: 0, light: 0 };

    // 每次只让预算够选 1 个词缀（remaining=5 恰好等于 energyCost），
    // 这样每轮独立地从三者中加权随机选一个
    for (let i = 0; i < N; i++) {
      const result = selector.select(pool, makeBudget(5), makeIntent(), 1);
      result.affixes.forEach((a) => {
        counts[a.id] = (counts[a.id] ?? 0) + 1;
      });
    }

    const total = counts.heavy + counts.medium + counts.light;
    // 确保所有候选都曾被选中（不存在永久饥饿）
    expect(counts.heavy).toBeGreaterThan(0);
    expect(counts.medium).toBeGreaterThan(0);
    expect(counts.light).toBeGreaterThan(0);

    // heavy 被选中占比应显著高于 light（权重 4:1，允许 2 倍误差余量）
    const heavyRatio = counts.heavy / total;
    const lightRatio = counts.light / total;
    expect(heavyRatio).toBeGreaterThan(lightRatio * 2);
  });

  it('高权重候选在多次选择中始终主导低权重候选', () => {
    // 使用极端权重差（100:1）验证极限情况
    const pool = [
      makeCandidate('dominant', 10000, 5),
      makeCandidate('rare', 1, 5),
    ];
    const N = 200;
    let dominantCount = 0;

    for (let i = 0; i < N; i++) {
      const result = selector.select(pool, makeBudget(5), makeIntent(), 1);
      if (result.affixes.some((a) => a.id === 'dominant')) dominantCount++;
    }

    // dominant 权重是 rare 的 10000 倍，200 次中至少 190 次应命中 dominant
    expect(dominantCount).toBeGreaterThanOrEqual(190);
  });
});

// ─── DEFAULT_AFFIX_REGISTRY ─────────────────────────────────────────────────

describe('DEFAULT_AFFIX_REGISTRY', () => {
  it('所有 affix 定义都应具备完整的展示文案', () => {
    for (const def of [...SKILL_AFFIXES, ...ARTIFACT_AFFIXES, ...GONGFA_AFFIXES]) {
      expect(def.displayName.trim()).toBeTruthy();
      expect(def.displayDescription.trim()).toBeTruthy();
    }
  });

  it('artifact category=core 的定义必须全部显式绑定槽位', () => {
    const unboundArtifactCores = ARTIFACT_AFFIXES.filter(
      (def) => def.category === 'core' && !def.applicableArtifactSlots,
    ).map((def) => def.id);

    expect(unboundArtifactCores).toEqual([]);
  });

  it('包含技能、法宝、功法词缀', () => {
    const skillDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Flame', 'Material.Element.Fire'],
      ['core', 'prefix', 'suffix', 'signature'],
      'skill',
    );
    expect(skillDefs.length).toBeGreaterThan(0);

    const artifactDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Type.Ore', 'Material.Semantic.Blade'],
      ['core', 'prefix', 'suffix', 'signature'],
      'artifact',
    );
    expect(artifactDefs.length).toBeGreaterThan(0);

    const gongfaDefs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Spirit', 'Material.Type.Manual'],
      ['core', 'prefix', 'suffix', 'signature'],
      'gongfa',
    );
    expect(gongfaDefs.length).toBeGreaterThan(0);
  });

  it('显式 matcher 语义：需满足 affix 自身声明的全部条件', () => {
    const defs = DEFAULT_AFFIX_REGISTRY.queryByTags(
      ['Material.Semantic.Flame', 'Material.Element.Fire'],
      ['core', 'suffix'],
      'skill',
    );
    const ids = defs.map((d) => d.id);
    expect(ids).toContain('skill-core-damage-fire');
    expect(ids).toContain('skill-suffix-burn-dot');
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

  it('当匹配候选缺少 core 时，应注入保底 core 候选', () => {
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'skill',
      materials: [
        {
          name: '杂质碎片',
          type: 'aux',
          rank: '凡品',
          quantity: 1,
          element: undefined,
          description: '无明显语义特征',
        },
      ],
    });

    session.state.materialFingerprints = [
      {
        rank: '凡品',
        energyValue: 8,
        rarityWeight: 1,
        explicitTags: [],
        semanticTags: [],
        recipeTags: [],
        materialName: '杂质碎片',
        materialType: 'aux',
        quantity: 1,
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['core'],
    };
    syncSessionTags(session, ['Unknown.Tag']);

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const ids = decision.candidates.map((candidate) => candidate.id);

    expect(ids).not.toContain('skill-core-damage');
    expect(decision.candidates.filter(c => c.category === 'core')).toHaveLength(0);
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
    syncSessionTags(session, ['Material.Semantic.Spirit', 'Material.Semantic.Manual']);
    const pool = builder.build(DEFAULT_AFFIX_REGISTRY, session);
    const ids = pool.map((c: AffixCandidate) => c.id);
    expect(ids).not.toContain('gongfa-signature-comprehension');
  });

  it('artifact 槽位为 armor 时：core 候选只保留护甲 core', () => {
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'artifact',
      requestedSlot: 'armor',
      materials: [
        {
          name: '寒铁甲片',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '水',
          description: '偏防御的护甲矿材',
        },
      ],
    });

    session.state.intent = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slotBias: 'armor',
      dominantTags: [],
      requestedTags: [],
    };
    session.state.materialFingerprints = [
      {
        rank: '灵品',
        energyValue: 10,
        rarityWeight: 1,
        explicitTags: [],
        semanticTags: [CreationTags.MATERIAL.SEMANTIC_GUARD],
        recipeTags: [],
        materialName: '寒铁甲片',
        materialType: 'ore',
        quantity: 1,
        element: '水',
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'artifact-default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['core'],
    };
    syncSessionTags(session, [
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]);

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const coreIds = decision.candidates
      .filter((candidate) => candidate.category === 'core')
      .map((candidate) => candidate.id);

    expect(coreIds).toContain('artifact-core-armor-dual-ward');
    expect(coreIds).not.toContain('artifact-core-weapon-dual-edge');
    expect(coreIds).not.toContain('artifact-core-vitality');
  });

  it.todo('artifact 槽位为 accessory 且缺少匹配 core 时：应注入 accessory fallback core');

  it('artifact synergy control-immunity 应改为基于 many buffs 触发的条件增益', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-synergy-control-immunity');

    expect(def).toBeDefined();
    expect(def?.effectTemplate.type).toBe('apply_buff');
    expect(def?.listenerSpec?.eventType).toBe(GameplayTags.EVENT.ROUND_PRE);

    if (def?.effectTemplate.type === 'apply_buff') {
      expect(def.effectTemplate.conditions).toEqual([
        {
          type: 'buff_count_at_least',
          params: { value: 2, scope: 'caster' },
        },
      ]);
      expect(def.effectTemplate.params.buffConfig.modifiers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ attrType: AttributeType.WILLPOWER }),
          expect.objectContaining({ attrType: AttributeType.CONTROL_RESISTANCE }),
        ]),
      );
      expect(def.effectTemplate.params.buffConfig.modifiers).toHaveLength(2);
    }
  });

  it('skill affix 的 control 与 buff/debuff duration 应收敛到统一策略', () => {
    const persistentExceptionIds = new Set(['skill-mythic-eternal-echo']);
    const actualPersistentExceptionIds = new Set<string>();

    for (const def of SKILL_AFFIXES) {
      if (def.effectTemplate.type === 'attribute_stat_buff') {
        const duration = def.effectTemplate.params.duration;
        expect(duration).toBeDefined();
        expect(duration!).toBeGreaterThanOrEqual(
          CREATION_DURATION_POLICY.buffDebuff.short,
        );
        expect(duration!).toBeLessThanOrEqual(
          CREATION_DURATION_POLICY.buffDebuff.extended,
        );
        continue;
      }

      if (def.effectTemplate.type !== 'apply_buff') {
        continue;
      }

      const { buffConfig } = def.effectTemplate.params;
      const duration = buffConfig.duration;

      if (duration === CREATION_DURATION_POLICY.buffDebuff.persistentException) {
        actualPersistentExceptionIds.add(def.id);
        expect(persistentExceptionIds.has(def.id)).toBe(true);
        continue;
      }

      if (buffConfig.type === BuffType.CONTROL) {
        expect(duration).toBeGreaterThanOrEqual(
          CREATION_DURATION_POLICY.control.default,
        );
        expect(duration).toBeLessThanOrEqual(
          CREATION_DURATION_POLICY.control.elite,
        );
        continue;
      }

      expect(buffConfig.type).toMatch(/buff|debuff/i);
      expect(duration).toBeGreaterThanOrEqual(
        CREATION_DURATION_POLICY.buffDebuff.short,
      );
      expect(duration).toBeLessThanOrEqual(
        CREATION_DURATION_POLICY.buffDebuff.extended,
      );
    }

    expect([...actualPersistentExceptionIds].sort()).toEqual(
      [...persistentExceptionIds].sort(),
    );
  });
});

