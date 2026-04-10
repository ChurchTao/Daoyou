import { DefaultEnergyBudgeter } from '@/engine/creation-v2/budgeting/DefaultEnergyBudgeter';

describe('DefaultEnergyBudgeter', () => {
  const budgeter = new DefaultEnergyBudgeter();

  it('应在 allocate 阶段加入多样性与语义一致性奖励', () => {
    const next = budgeter.allocate(
      [
        {
          materialName: '赤炎铁',
          materialType: 'ore',
          rank: '玄品',
          quantity: 1,
          explicitTags: [],
          semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Burst'],
          recipeTags: [],
          energyValue: 8,
          rarityWeight: 2,
        },
        {
          materialName: '雷髓晶',
          materialType: 'monster',
          rank: '玄品',
          quantity: 1,
          explicitTags: [],
          semanticTags: ['Material.Semantic.Flame'],
          recipeTags: [],
          energyValue: 7,
          rarityWeight: 2,
        },
      ],
      { recipeId: 'skill-default', valid: true, matchedTags: [], unlockedAffixCategories: ['core'], reservedEnergy: 5 },
    );

    // base=15, diversity(types=2)=>+2, coherence(maxShared flame=2)=>+2, effective=19
    expect(next.effectiveTotal).toBe(19);
    expect(next.baseTotal).toBe(15);
    expect(next.effectiveTotal).toBe(19);
    expect(next.reserved).toBe(5);
    expect(next.remaining).toBe(14);
    expect(next.sources).toEqual(
      expect.arrayContaining([
        { source: 'bonus:diversity', amount: 2 },
        { source: 'bonus:coherence', amount: 2 },
      ]),
    );
  });

  it('应基于 selection audit 回填闭环账本', () => {
    const next = budgeter.finalizeSelection(
      {
        baseTotal: 30,
        effectiveTotal: 30,
        reserved: 6,
        spent: 0,
        remaining: 24,
        initialRemaining: 24,
        allocations: [],
        rejections: [],
        sources: [{ source: '测试材料', amount: 30 }],
      },
      {
        rounds: [],
        affixes: [],
        spent: 14,
        remaining: 10,
        allocations: [
          { affixId: 'a', amount: 8 },
          { affixId: 'b', amount: 6 },
        ],
        rejections: [
          { affixId: 'c', amount: 12, reason: 'budget_exhausted' },
        ],
        exhaustionReason: 'budget_exhausted',
      },
    );

    expect(next).toMatchObject({
      spent: 14,
      remaining: 10,
      allocations: [
        { affixId: 'a', amount: 8 },
        { affixId: 'b', amount: 6 },
      ],
      rejections: [{ affixId: 'c', amount: 12, reason: 'budget_exhausted' }],
      exhaustionReason: 'budget_exhausted',
    });
  });

  it('应在显式回写 rolled affixes 时保持能量守恒', () => {
    const next = budgeter.reconcileRolledAffixes(
      {
        baseTotal: 28,
        effectiveTotal: 28,
        reserved: 4,
        spent: 0,
        remaining: 24,
        initialRemaining: 24,
        allocations: [],
        rejections: [],
        sources: [{ source: '测试材料', amount: 28 }],
      },
      [
        {
          id: 'a',
          name: 'A',
          category: 'core',
          tags: [],
          weight: 100,
          energyCost: 8,
          rollScore: 1,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
          effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
        },
        {
          id: 'b',
          name: 'B',
          category: 'suffix',
          tags: [],
          weight: 100,
          energyCost: 6,
          rollScore: 0.8,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
          effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
        },
      ],
    );

    expect(next.spent).toBe(14);
    expect(next.remaining).toBe(10);
    expect(next.effectiveTotal).toBe(
      next.reserved + next.spent + next.remaining,
    );
  });

  it('应拒绝不守恒的 selection audit 结算结果', () => {
    expect(() =>
      budgeter.finalizeSelection(
        {
          baseTotal: 30,
          effectiveTotal: 30,
          reserved: 6,
          spent: 0,
          remaining: 24,
          initialRemaining: 24,
          allocations: [],
          rejections: [],
          sources: [{ source: '测试材料', amount: 30 }],
        },
        {
          rounds: [],
          affixes: [],
          spent: 14,
          remaining: 11,
          allocations: [{ affixId: 'a', amount: 14 }],
          rejections: [],
        },
      ),
    ).toThrow('Energy budget ledger mismatch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 能量阈值 × 槽位梯次校准基准测试
// 验证 CREATION_AFFIX_UNLOCK_THRESHOLDS 与 CREATION_ENERGY_SLOT_TIERS 的设计一致性：
//   低投入  → prefix 解锁，2 词缀槽位
//   中投入  → resonance 解锁，3 词缀槽位
//   高投入  → signature/synergy 解锁，4 词缀槽位
//   顶级投入 → mythic 解锁，5 词缀槽位
// ─────────────────────────────────────────────────────────────────────────────
import { resolveAffixSlotCount, CREATION_AFFIX_UNLOCK_THRESHOLDS } from '@/engine/creation-v2/config/CreationBalance';

describe('能量阈值与槽位梯次基准校准', () => {
  it('低投入：可支配能量低于 18 时应保持 2 词缀槽位', () => {
    const lowAvailableEnergy = 17;
    expect(resolveAffixSlotCount(lowAvailableEnergy)).toBe(2);
    expect(lowAvailableEnergy).toBeLessThan(CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix);
  });

  it('中低投入：可支配能量进入 3 槽区间后应给 3 词缀槽位', () => {
    const borderEnergy = 18;
    expect(resolveAffixSlotCount(borderEnergy)).toBe(3);
  });

  it('中等投入：34 点可支配能量应进入 4 词缀槽位', () => {
    const midEnergy = 34;
    expect(resolveAffixSlotCount(midEnergy)).toBe(4);
    expect(midEnergy).toBeGreaterThanOrEqual(CREATION_AFFIX_UNLOCK_THRESHOLDS.resonance);
    expect(midEnergy).toBeLessThan(CREATION_AFFIX_UNLOCK_THRESHOLDS.synergy);
  });

  it('高投入：56 点可支配能量才开放最大 5 词缀槽位', () => {
    const highEnergy = 56;
    expect(resolveAffixSlotCount(highEnergy)).toBe(5);
    expect(highEnergy).toBeGreaterThanOrEqual(CREATION_AFFIX_UNLOCK_THRESHOLDS.synergy);
  });

  it('顶级投入：unlock threshold 仍应明显高于 5 槽位门槛', () => {
    const topEnergy = CREATION_AFFIX_UNLOCK_THRESHOLDS.mythic;
    expect(resolveAffixSlotCount(topEnergy)).toBe(5);
    expect(topEnergy).toBeGreaterThanOrEqual(CREATION_AFFIX_UNLOCK_THRESHOLDS.mythic);
  });

  it('阈值有序性：unlock thresholds 应严格递增', () => {
    const t = CREATION_AFFIX_UNLOCK_THRESHOLDS;
    expect(t.prefix).toBeLessThan(t.suffix);
    expect(t.suffix).toBeLessThan(t.resonance);
    expect(t.resonance).toBeLessThan(t.signature);
    expect(t.signature).toBeLessThan(t.synergy);
    expect(t.synergy).toBeLessThan(t.mythic);
  });

  it('槽位梯次有序性：高能量对应更多词缀槽位', () => {
    expect(resolveAffixSlotCount(10)).toBeLessThanOrEqual(resolveAffixSlotCount(24));
    expect(resolveAffixSlotCount(24)).toBeLessThanOrEqual(resolveAffixSlotCount(40));
    expect(resolveAffixSlotCount(40)).toBeLessThanOrEqual(resolveAffixSlotCount(60));
  });
});