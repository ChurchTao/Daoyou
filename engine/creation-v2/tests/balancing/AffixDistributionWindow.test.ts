import { matchAll } from '@/engine/creation-v2/affixes';
import { AffixSelector } from '@/engine/creation-v2/affixes/AffixSelector';
import { AffixCandidate, CreationIntent, EnergyBudget } from '@/engine/creation-v2/types';

function candidate(
  id: string,
  category: AffixCandidate['category'],
  weight: number,
  energyCost: number,
): AffixCandidate {
  return {
    id,
    name: id,
    category,
    match: matchAll(['Material.Semantic.Burst', 'Material.Semantic.Spirit']),
    tags: ['Material.Semantic.Burst', 'Material.Semantic.Spirit'],
    weight,
    energyCost,
    effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
  };
}

const intent: CreationIntent = {
  productType: 'skill',
  outcomeKind: 'active_skill',
  dominantTags: ['Material.Semantic.Burst', 'Material.Semantic.Spirit'],
  requestedTags: [],
};

const budget: EnergyBudget = {
  baseTotal: 50,
  effectiveTotal: 50,
  reserved: 4,
  spent: 0,
  remaining: 46,
  allocations: [],
  sources: [],
};

describe('Affix high-tier distribution window', () => {
  it('高阶词缀占比应落在软区间内', () => {
    const selector = new AffixSelector();
    const pool: AffixCandidate[] = [
      candidate('core-main', 'skill_core', 90, 8),
      candidate('prefix-a', 'skill_variant', 80, 6),
      candidate('prefix-b', 'skill_variant', 72, 6),
      candidate('suffix-a', 'skill_variant', 76, 7),
      candidate('suffix-b', 'skill_variant', 70, 7),
      candidate('res-a', 'skill_variant', 44, 9),
      candidate('sig-a', 'skill_rare', 28, 11),
      candidate('syn-a', 'skill_rare', 20, 12),
      candidate('my-a', 'skill_rare', 10, 14),
    ];

    let nonCoreTotal = 0;
    let highTierTotal = 0;

    for (let i = 0; i < 500; i++) {
      const result = selector.select(pool, budget, intent, 5);
      const nonCore = result.affixes.filter((a) => a.category !== 'skill_core');
      const highTier = nonCore.filter((a) => a.category === 'skill_rare');

      nonCoreTotal += nonCore.length;
      highTierTotal += highTier.length;
    }

    const highTierShare = highTierTotal / Math.max(1, nonCoreTotal);

    expect(highTierShare).toBeGreaterThanOrEqual(0.03);
    expect(highTierShare).toBeLessThanOrEqual(0.32);
    expect(highTierTotal).toBeGreaterThan(0);
  });
});
