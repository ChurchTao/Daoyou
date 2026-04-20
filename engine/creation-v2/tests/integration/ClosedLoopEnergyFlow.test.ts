import { matchAll } from '@/engine/creation-v2/affixes';
import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import type { AffixCandidate } from '@/engine/creation-v2/types';
import type { ExclusiveGroup } from '@/engine/creation-v2/affixes/exclusiveGroups';

function candidate(
  id: string,
  category: AffixCandidate['category'],
  energyCost: number,
  exclusiveGroup?: ExclusiveGroup,
): AffixCandidate {
  return {
    id,
    name: id,
    category,
    match: matchAll([]),
    tags: [],
    weight: 100,
    energyCost,
    exclusiveGroup,
    effectTemplate: {
      type: 'damage',
      params: { value: { base: 10, attribute: 'magicAtk' } },
    } as any,
  };
}

function createSkillSession() {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId: 'closed-loop-energy',
    productType: 'skill',
    materials: [],
  });

  session.state.intent = {
    productType: 'skill',
    outcomeKind: 'active_skill',
    dominantTags: ['Material.Semantic.Blade'],
    requestedTags: [],
  };

  return { orchestrator, session };
}

describe('Closed-loop energy flow', () => {
  it('应维持 effectiveTotal = reserved + spent + remaining', () => {
    const { orchestrator, session } = createSkillSession();
    const pool: AffixCandidate[] = [
      candidate('a', 'skill_core', 8),
      candidate('b', 'skill_variant', 6),
      candidate('c', 'skill_variant', 12),
    ];

    orchestrator.budgetEnergy(session, {
      baseTotal: 30,
      effectiveTotal: 30,
      reserved: 6,
      spent: 0,
      remaining: 24,
      initialRemaining: 24,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试材料', amount: 30 }],
    });
    orchestrator.buildAffixPool(session, pool);
    orchestrator.rollAffixesWithDefaults(session);

    const budget = session.state.energyBudget!;
    const allocated = budget.allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );

    expect(budget.initialRemaining).toBe(budget.effectiveTotal - budget.reserved);
    expect(budget.spent).toBe(allocated);
    expect(budget.effectiveTotal).toBe(
      budget.reserved + budget.spent + budget.remaining,
    );
    expect(session.state.affixSelectionAudit?.rounds.length).toBeGreaterThan(0);
    expect(session.state.affixSelectionAudit?.finalDecision).toBe(
      session.state.affixSelectionFinalDecision,
    );
  });

  it('应记录独占组冲突，并保留终止原因', () => {
    const { orchestrator, session } = createSkillSession();
    const pool: AffixCandidate[] = [
      candidate('grp-a', 'skill_core', 5, 'blade' as ExclusiveGroup),
      candidate('grp-b', 'skill_variant', 5, 'blade' as ExclusiveGroup),
      candidate('heavy', 'skill_variant', 20),
    ];

    orchestrator.budgetEnergy(session, {
      baseTotal: 16,
      effectiveTotal: 16,
      reserved: 4,
      spent: 0,
      remaining: 12,
      initialRemaining: 12,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试材料', amount: 16 }],
    });
    orchestrator.buildAffixPool(session, pool);
    orchestrator.rollAffixesWithDefaults(session);

    const budget = session.state.energyBudget!;
    expect(
      budget.rejections?.some(
        (rejection) => rejection.reason === 'exclusive_group_conflict',
      ),
    ).toBe(true);
    expect(budget.exhaustionReason).toBeDefined();
  });
});