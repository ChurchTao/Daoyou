import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { AffixCandidate } from '@/engine/creation-v2/types';

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
  it('应维持 total = reserved + spent + remaining', () => {
    const { orchestrator, session } = createSkillSession();
    const pool: AffixCandidate[] = [
      {
        id: 'a',
        name: 'A',
        category: 'core',
        tags: [],
        weight: 100,
        energyCost: 8,
      },
      {
        id: 'b',
        name: 'B',
        category: 'prefix',
        tags: [],
        weight: 100,
        energyCost: 6,
      },
      {
        id: 'c',
        name: 'C',
        category: 'suffix',
        tags: [],
        weight: 100,
        energyCost: 12,
      },
    ];

    orchestrator.budgetEnergy(session, {
      total: 30,
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

    expect(budget.initialRemaining).toBe(budget.total - budget.reserved);
    expect(budget.spent).toBe(allocated);
    expect(budget.total).toBe(budget.reserved + budget.spent + budget.remaining);
  });

  it('应记录预算耗尽与独占组冲突的拒绝原因', () => {
    const { orchestrator, session } = createSkillSession();
    const pool: AffixCandidate[] = [
      {
        id: 'grp-a',
        name: 'grp-a',
        category: 'core',
        tags: [],
        weight: 100,
        energyCost: 5,
        exclusiveGroup: 'blade',
      },
      {
        id: 'grp-b',
        name: 'grp-b',
        category: 'prefix',
        tags: [],
        weight: 100,
        energyCost: 5,
        exclusiveGroup: 'blade',
      },
      {
        id: 'heavy',
        name: 'heavy',
        category: 'suffix',
        tags: [],
        weight: 100,
        energyCost: 20,
      },
    ];

    orchestrator.budgetEnergy(session, {
      total: 16,
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
    expect(
      budget.rejections?.some(
        (rejection) => rejection.reason === 'budget_exhausted',
      ),
    ).toBe(true);
    expect(budget.exhaustionReason).toBeDefined();
  });
});