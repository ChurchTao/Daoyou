import { describe, expect, it } from '@jest/globals';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { AffixPoolBuilder } from '@/engine/creation-v2/affixes/AffixPoolBuilder';
import { AffixSelector } from '@/engine/creation-v2/affixes/AffixSelector';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { ARTIFACT_AFFIXES } from '@/engine/creation-v2/affixes/definitions/artifactAffixes';
import { GONGFA_AFFIXES } from '@/engine/creation-v2/affixes/definitions/gongfaAffixes';
import { SKILL_AFFIXES } from '@/engine/creation-v2/affixes/definitions/skillAffixes';
import { CREATION_DURATION_POLICY } from '@/engine/creation-v2/config/CreationBalance';
import { AttributeType, BuffType, ModifierType } from '@/engine/creation-v2/contracts/battle';
import { ELEMENT_TO_ABILITY_TAG } from '@/engine/creation-v2/config/CreationMappings';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import { AffixCandidate, EnergyBudget, CreationIntent } from '@/engine/creation-v2/types';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';

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
      // base: { base:80, scale:quality, coefficient:14 } → 凡品 qualityOrder=0 → 80
      expect(resultFan.params.value.base).toBe(80);
      expect(resultFan.params.value.coefficient).toBe(0.9);
    }

    const resultZhen = translator.translate(def, '真品');
    if (resultZhen.type === 'damage') {
      // 真品 qualityOrder=3 → 80 + 3*14 = 122
      expect(resultZhen.params.value.base).toBe(122);
    }
  });

  it('translate: attribute_stat_buff 生成 apply_buff with modifiers（临时 buff）', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-prefix-spirit-boost')!;
    expect(def).toBeDefined();

    const result = translator.translate(def, '凡品');
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

    const resultZhen = translator.translate(def, '真品');
    if (resultZhen.type === 'apply_buff') {
      // 真品 qualityOrder=3 → 3 + 3*1=6
      expect(resultZhen.params.buffConfig.modifiers![0].value).toBe(6);
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

  it('translate: ability_has_tag 条件应原样透传到 battle-v5', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-prefix-fire-resistance')!;
    const result = translator.translate(def, '凡品');

    expect(result.conditions).toEqual([
      {
        type: 'ability_has_tag',
        params: { tag: ELEMENT_TO_ABILITY_TAG['火'] },
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
            params: { tag: ELEMENT_TO_ABILITY_TAG[element] },
          },
        ]);
      }
    }
  });

  it('translate: damage_immunity 应保留 battle-v5 标签参数', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-signature-spellward')!;
    const result = translator.translate(def, '真品');
    expect(result.type).toBe('damage_immunity');
    if (result.type === 'damage_immunity') {
      expect(result.params.tags).toEqual([CreationTags.BATTLE.ABILITY_TYPE_MAGIC]);
    }
  });

  it('translate: buff_immunity 应保留 battle-v5 标签参数', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-suffix-buff-immunity')!;
    const result = translator.translate(def, '玄品');
    expect(result.type).toBe('buff_immunity');
    if (result.type === 'buff_immunity') {
      expect(result.params.tags).toEqual([CreationTags.BATTLE.BUFF_TYPE_DEBUFF]);
    }
  });

  it('translate: artifact mana recovery 应生成真实 MP 回复效果', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-suffix-mana-recovery')!;
    const result = translator.translate(def, '玄品');

    expect(result.type).toBe('heal');
    if (result.type === 'heal') {
      expect(result.params.target).toBe('mp');
      expect(result.params.value.base).toBeGreaterThan(0);
    }
  });

  it('translate: skill dispel-buff 应只驱散正面 buff 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-suffix-dispel-buff')!;
    const result = translator.translate(def, '凡品');

    expect(result.type).toBe('dispel');
    if (result.type === 'dispel') {
      expect(result.params.targetTag).toBe(CreationTags.BATTLE.BUFF_TYPE_BUFF);
    }
  });

  it('translate: gongfa debuff-cleanse 应只驱散负面 buff 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-suffix-debuff-cleanse')!;
    const result = translator.translate(def, '凡品');

    expect(result.type).toBe('dispel');
    if (result.type === 'dispel') {
      expect(result.params.targetTag).toBe(CreationTags.BATTLE.BUFF_TYPE_DEBUFF);
    }
  });

  it('translate: control buff 应拆分 buff tags 与控制 statusTags', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-control-stun')!;
    const result = translator.translate(def, '凡品');

    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      expect(result.params.buffConfig.tags).toHaveLength(2);
      expect(result.params.buffConfig.tags).toEqual(expect.arrayContaining([
        CreationTags.BATTLE.BUFF_TYPE_DEBUFF,
        CreationTags.BATTLE.BUFF_TYPE_CONTROL,
      ]));
      expect(result.params.buffConfig.statusTags).toHaveLength(4);
      expect(result.params.buffConfig.statusTags).toEqual(expect.arrayContaining([
        CreationTags.BATTLE.STATUS_DEBUFF,
        CreationTags.BATTLE.STATUS_CONTROL,
        CreationTags.BATTLE.STATUS_STUNNED,
        CreationTags.BATTLE.STATUS_NO_ACTION,
      ]));
    }
  });

  it('translate: burn dot buff 应同时携带 debuff tags 与 burn statusTags', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-suffix-burn-dot')!;
    const result = translator.translate(def, '凡品');

    expect(result.type).toBe('apply_buff');
    if (result.type === 'apply_buff') {
      expect(result.params.buffConfig.tags).toHaveLength(3);
      expect(result.params.buffConfig.tags).toEqual(expect.arrayContaining([
        CreationTags.BATTLE.BUFF_TYPE_DEBUFF,
        CreationTags.BATTLE.BUFF_DOT,
        CreationTags.BATTLE.BUFF_DOT_BURN,
      ]));
      expect(result.params.buffConfig.statusTags).toHaveLength(3);
      expect(result.params.buffConfig.statusTags).toEqual(expect.arrayContaining([
        CreationTags.BATTLE.STATUS_DEBUFF,
        CreationTags.BATTLE.STATUS_DOT,
        CreationTags.BATTLE.STATUS_BURN,
      ]));
    }
  });

  it('translate: attribute_stat_buff MULTIPLY modType 生成乘数 modifier', () => {
    const def: AffixDefinition = {
      id: 'test-multiply-buff',
      displayName: 'test',
      displayDescription: 'test',
      category: 'prefix',
      tagQuery: [],
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

    const resultXuan = translator.translate(def, '玄品');
    expect(resultXuan.type).toBe('apply_buff');
    if (resultXuan.type === 'apply_buff') {
      const mod = resultXuan.params.buffConfig.modifiers![0];
      expect(mod.attrType).toBe(AttributeType.WISDOM);
      expect(mod.type).toBe(ModifierType.MULTIPLY);
      expect(mod.value).toBeCloseTo(0.16);
    }

    const resultTian = translator.translate(def, '天品');
    if (resultTian.type === 'apply_buff') {
      const mod = resultTian.params.buffConfig.modifiers![0];
      expect(mod.value).toBeCloseTo(0.22);
    }
  });

  it('translate: attribute_modifier 应在翻译阶段拒绝（由投影层处理）', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-spirit')!;
    expect(() => translator.translate(def, '凡品')).toThrow(
      'attribute_modifier must be projected to AbilityConfig.modifiers in passive policy',
    );
  });

  it('translate: death_prevent 应生成原子免死效果', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-core-death-prevent')!;
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
    category: AffixCandidate['category'] = 'core',
  ): AffixCandidate => ({
    id,
    name: id,
    category,
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

  it('所有 DamageTakenEvent + damage 词条都必须显式反击 event.caster', () => {
    const counterDamageDefs = [...SKILL_AFFIXES, ...ARTIFACT_AFFIXES, ...GONGFA_AFFIXES].filter(
      (def) =>
        def.listenerSpec?.eventType === CreationTags.BATTLE_EVENT.DAMAGE_TAKEN &&
        def.effectTemplate.type === 'damage',
    );

    expect(counterDamageDefs.length).toBeGreaterThan(0);

    for (const def of counterDamageDefs) {
      expect(def.listenerSpec?.mapping).toEqual({
        caster: 'owner',
        target: 'event.caster',
      });
    }
  });

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
    // skill-core-damage-fire 和一条燃烧后缀均应命中
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
    session.state.tags = ['Unknown.Tag'];

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const ids = decision.candidates.map((candidate) => candidate.id);

    expect(ids).toContain('skill-core-damage');
    expect(
      decision.warnings.some(
        (warning) => warning.code === 'affix_core_fallback_injected',
      ),
    ).toBe(true);
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
    session.state.tags = [
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ];

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const coreIds = decision.candidates
      .filter((candidate) => candidate.category === 'core')
      .map((candidate) => candidate.id);

    expect(coreIds).toContain('artifact-core-armor-dual-ward');
    expect(coreIds).not.toContain('artifact-core-weapon-dual-edge');
    expect(coreIds).not.toContain('artifact-core-vitality');
    expect(DEFAULT_AFFIX_REGISTRY.queryById('artifact-core-vitality')?.category).toBe('prefix');
    expect(DEFAULT_AFFIX_REGISTRY.queryById('artifact-core-death-prevent')?.category).toBe('suffix');
  });

  it('artifact 槽位为 accessory 且缺少匹配 core 时：应注入 accessory fallback core', () => {
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'artifact',
      requestedSlot: 'accessory',
      materials: [
        {
          name: '古玉佩',
          type: 'aux',
          rank: '凡品',
          quantity: 1,
          element: undefined,
          description: '偏饰品方向的古玉',
        },
      ],
    });

    session.state.intent = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slotBias: 'accessory',
      dominantTags: [],
      requestedTags: [],
    };
    session.state.materialFingerprints = [
      {
        rank: '凡品',
        energyValue: 8,
        rarityWeight: 1,
        explicitTags: [],
        semanticTags: [],
        recipeTags: [],
        materialName: '古玉佩',
        materialType: 'aux',
        quantity: 1,
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'artifact-default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['core'],
    };
    session.state.tags = ['Unknown.Tag'];

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const coreIds = decision.candidates
      .filter((candidate) => candidate.category === 'core')
      .map((candidate) => candidate.id);

    expect(coreIds).toContain('artifact-core-accessory-omen');
    expect(
      decision.warnings.some(
        (warning) => warning.code === 'affix_core_fallback_injected',
      ),
    ).toBe(true);
  });

  it('artifact slot-bound core 应为 weapon/armor/accessory 提供显式 T2/T3/T4 梯度', () => {
    const expectedTierIds = [
      ['artifact-core-weapon-dual-edge-t2', 'weapon'],
      ['artifact-core-weapon-dual-edge-t3', 'weapon'],
      ['artifact-core-weapon-dual-edge-t4', 'weapon'],
      ['artifact-core-armor-dual-ward-t2', 'armor'],
      ['artifact-core-armor-dual-ward-t3', 'armor'],
      ['artifact-core-armor-dual-ward-t4', 'armor'],
      ['artifact-core-accessory-omen-t2', 'accessory'],
      ['artifact-core-accessory-omen-t3', 'accessory'],
      ['artifact-core-accessory-omen-t4', 'accessory'],
      ['artifact-core-accessory-skystride-t2', 'accessory'],
      ['artifact-core-accessory-skystride-t3', 'accessory'],
      ['artifact-core-accessory-skystride-t4', 'accessory'],
      ['artifact-core-accessory-command-t2', 'accessory'],
      ['artifact-core-accessory-command-t3', 'accessory'],
      ['artifact-core-accessory-command-t4', 'accessory'],
      ['artifact-core-accessory-riftpiercer-t2', 'accessory'],
      ['artifact-core-accessory-riftpiercer-t3', 'accessory'],
      ['artifact-core-accessory-riftpiercer-t4', 'accessory'],
      ['artifact-core-accessory-aegis-soul-t2', 'accessory'],
      ['artifact-core-accessory-aegis-soul-t3', 'accessory'],
      ['artifact-core-accessory-aegis-soul-t4', 'accessory'],
      ['artifact-core-accessory-renewal-t2', 'accessory'],
      ['artifact-core-accessory-renewal-t3', 'accessory'],
      ['artifact-core-accessory-renewal-t4', 'accessory'],
    ] as const;

    for (const [affixId, slot] of expectedTierIds) {
      const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
      expect(def).toBeDefined();
      expect(def?.category).toBe('core');
      expect(def?.applicableArtifactSlots).toEqual([slot]);
    }
  });

  it('artifact resonance dual-defense 应同时投影物防与法防 modifiers', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-resonance-dual-defense');

    expect(def).toBeDefined();
    expect(def?.effectTemplate.type).toBe('attribute_modifier');

    if (def?.effectTemplate.type === 'attribute_modifier') {
      expect('modifiers' in def.effectTemplate.params).toBe(true);

      if ('modifiers' in def.effectTemplate.params) {
        expect(def.effectTemplate.params.modifiers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ attrType: AttributeType.DEF }),
            expect.objectContaining({ attrType: AttributeType.MAGIC_DEF }),
          ]),
        );
        expect(def.effectTemplate.params.modifiers).toHaveLength(2);
      }
    }
  });

  it('artifact synergy control-immunity 应改为基于 many buffs 触发的条件增益', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-synergy-control-immunity');

    expect(def).toBeDefined();
    expect(def?.effectTemplate.type).toBe('apply_buff');
    expect(def?.listenerSpec?.eventType).toBe(CreationTags.BATTLE_EVENT.ROUND_PRE);

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

  it('artifact resonance sustain-bond 应改为治疗增强 + 双防 modifiers', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-resonance-sustain-bond');

    expect(def).toBeDefined();
    expect(def?.effectTemplate.type).toBe('attribute_modifier');
    expect(def?.listenerSpec).toBeUndefined();

    if (def?.effectTemplate.type === 'attribute_modifier') {
      expect('modifiers' in def.effectTemplate.params).toBe(true);

      if ('modifiers' in def.effectTemplate.params) {
        expect(def.effectTemplate.params.modifiers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ attrType: AttributeType.HEAL_AMPLIFY }),
            expect.objectContaining({ attrType: AttributeType.DEF }),
            expect.objectContaining({ attrType: AttributeType.MAGIC_DEF }),
          ]),
        );
        expect(def.effectTemplate.params.modifiers).toHaveLength(3);
      }
    }
  });

  it('artifact resonance offensense-flow 应改为攻防同步抬升的四维 modifiers', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-resonance-offensense-flow');

    expect(def).toBeDefined();
    expect(def?.effectTemplate.type).toBe('attribute_modifier');
    expect(def?.listenerSpec).toBeUndefined();

    if (def?.effectTemplate.type === 'attribute_modifier') {
      expect('modifiers' in def.effectTemplate.params).toBe(true);

      if ('modifiers' in def.effectTemplate.params) {
        expect(def.effectTemplate.params.modifiers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ attrType: AttributeType.ATK }),
            expect.objectContaining({ attrType: AttributeType.MAGIC_ATK }),
            expect.objectContaining({ attrType: AttributeType.DEF }),
            expect.objectContaining({ attrType: AttributeType.MAGIC_DEF }),
          ]),
        );
        expect(def.effectTemplate.params.modifiers).toHaveLength(4);
      }
    }
  });

  it('skill core 候选应限制为 damage/heal/control 三类职责', () => {
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'skill',
      materials: [
        {
          name: '雷火玉简',
          type: 'skill_manual',
          rank: '玄品',
          quantity: 1,
          element: '雷',
          description: '兼具雷意、冰意与疗愈灵性的战技玉简',
        },
      ],
    });

    session.state.intent = {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: [],
      requestedTags: [],
    };
    session.state.materialFingerprints = [
      {
        rank: '玄品',
        energyValue: 18,
        rarityWeight: 3,
        explicitTags: [],
        semanticTags: [
          CreationTags.MATERIAL.SEMANTIC_THUNDER,
          CreationTags.MATERIAL.SEMANTIC_BURST,
          CreationTags.MATERIAL.SEMANTIC_SPIRIT,
          CreationTags.MATERIAL.SEMANTIC_BLADE,
          CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
          CreationTags.MATERIAL.SEMANTIC_FREEZE,
        ],
        recipeTags: [CreationTags.RECIPE.PRODUCT_BIAS_SKILL],
        materialName: '雷火玉简',
        materialType: 'skill_manual',
        quantity: 1,
        element: '雷',
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'skill-default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['core'],
    };
    session.state.tags = [
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.TYPE_HERB,
    ];

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const coreIds = decision.candidates
      .filter((candidate) => candidate.category === 'core')
      .map((candidate) => candidate.id);

    expect(coreIds).toContain('skill-core-damage');
    expect(coreIds).toContain('skill-core-heal');
    expect(coreIds).toContain('skill-core-control-stun');
    expect(coreIds).toContain('skill-core-control-stun-t2');
    expect(coreIds).not.toContain('skill-core-mana-burn');
    expect(DEFAULT_AFFIX_REGISTRY.queryById('skill-core-mana-burn')).toBeUndefined();
  });

  it('skill control core 应补齐 T2/T3/T4 梯度并保持 2-3 回合控制窗口', () => {
    const expectedTierIds = [
      'skill-core-control-stun-t2',
      'skill-core-control-stun-t3',
      'skill-core-control-stun-t4',
    ] as const;

    for (const affixId of expectedTierIds) {
      const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
      expect(def).toBeDefined();
      expect(def?.category).toBe('core');

      if (def?.effectTemplate.type === 'apply_buff') {
        expect(def.effectTemplate.params.buffConfig.type).toBe(BuffType.CONTROL);
        expect(def.effectTemplate.params.buffConfig.duration).toBeGreaterThanOrEqual(
          CREATION_DURATION_POLICY.control.default,
        );
        expect(def.effectTemplate.params.buffConfig.duration).toBeLessThanOrEqual(
          CREATION_DURATION_POLICY.control.elite,
        );
      }
    }
  });

  it('gongfa core 候选应限制为五维一级属性的稳定 modifiers', () => {
    const builder = new AffixPoolBuilder();
    const session = new CreationSession({
      productType: 'gongfa',
      materials: [
        {
          name: '太玄道卷',
          type: 'gongfa_manual',
          rank: '地品',
          quantity: 1,
          description: '兼具护体、身法、悟道与灵脉增益的高阶道卷',
        },
      ],
    });

    session.state.intent = {
      productType: 'gongfa',
      outcomeKind: 'gongfa',
      dominantTags: [],
      requestedTags: [],
    };
    session.state.materialFingerprints = [
      {
        rank: '地品',
        energyValue: 24,
        rarityWeight: 5,
        explicitTags: [],
        semanticTags: [
          CreationTags.MATERIAL.SEMANTIC_SPIRIT,
          CreationTags.MATERIAL.SEMANTIC_GUARD,
          CreationTags.MATERIAL.SEMANTIC_WIND,
          CreationTags.MATERIAL.SEMANTIC_BLADE,
          CreationTags.MATERIAL.SEMANTIC_MANUAL,
          CreationTags.MATERIAL.SEMANTIC_BURST,
        ],
        recipeTags: [CreationTags.RECIPE.PRODUCT_BIAS_GONGFA],
        materialName: '太玄道卷',
        materialType: 'gongfa_manual',
        quantity: 1,
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'gongfa-default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['core'],
    };
    session.state.tags = [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.TYPE_MANUAL,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ];

    const decision = builder.buildDecision(DEFAULT_AFFIX_REGISTRY, session);
    const coreIds = decision.candidates
      .filter((candidate) => candidate.category === 'core')
      .map((candidate) => candidate.id);

    expect(coreIds.some((id) => id.startsWith('gongfa-core-spirit'))).toBe(true);
    expect(coreIds.some((id) => id.startsWith('gongfa-core-vitality'))).toBe(true);
    expect(coreIds).toContain('gongfa-core-wisdom');
    expect(coreIds).toContain('gongfa-core-willpower');
    expect(coreIds).toContain('gongfa-core-speed-mastery');
    expect(coreIds).toContain('gongfa-core-wisdom-t2');
    expect(coreIds).toContain('gongfa-core-wisdom-t3');
    expect(coreIds).toContain('gongfa-core-wisdom-t4');
    expect(coreIds).toContain('gongfa-core-willpower-t2');
    expect(coreIds).toContain('gongfa-core-willpower-t3');
    expect(coreIds).toContain('gongfa-core-willpower-t4');
    expect(coreIds).toContain('gongfa-core-speed-mastery-t2');
    expect(coreIds).toContain('gongfa-core-speed-mastery-t3');
    expect(coreIds).toContain('gongfa-core-speed-mastery-t4');
    expect(coreIds).not.toContain('gongfa-core-magic-attack');
    expect(coreIds).not.toContain('gongfa-core-mana-burn-seal');
    expect(coreIds).not.toContain('gongfa-core-crit-rate-boost');
    expect(coreIds).not.toContain('gongfa-core-amp-dual-attribute');
    expect(coreIds).not.toContain('gongfa-core-backwater-mind');
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-magic-attack')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-mana-burn-seal')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-crit-rate-boost')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-amp-dual-attribute')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-backwater-mind')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-magic-attack-t2')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-magic-attack-t3')).toBeUndefined();
    expect(DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-magic-attack-t4')).toBeUndefined();
  });

  it('gongfa wisdom/willpower/speed 应具备完整高阶 tier ladder', () => {
    const expectedTierIds = [
      'gongfa-core-wisdom-t2',
      'gongfa-core-wisdom-t3',
      'gongfa-core-wisdom-t4',
      'gongfa-core-willpower-t2',
      'gongfa-core-willpower-t3',
      'gongfa-core-willpower-t4',
      'gongfa-core-speed-mastery-t2',
      'gongfa-core-speed-mastery-t3',
      'gongfa-core-speed-mastery-t4',
    ] as const;

    for (const affixId of expectedTierIds) {
      const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
      expect(def).toBeDefined();
      expect(def?.category).toBe('core');
      expect(def?.exclusiveGroup).toBe('gongfa-core-stat');
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

