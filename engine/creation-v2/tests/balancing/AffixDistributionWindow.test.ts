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
      candidate('core-main', 'core', 90, 8),
      candidate('prefix-a', 'prefix', 80, 6),
      candidate('prefix-b', 'prefix', 72, 6),
      candidate('suffix-a', 'suffix', 76, 7),
      candidate('suffix-b', 'suffix', 70, 7),
      candidate('res-a', 'resonance', 44, 9),
      candidate('sig-a', 'signature', 28, 11),
      candidate('syn-a', 'synergy', 20, 12),
      candidate('my-a', 'mythic', 10, 14),
    ];

    let nonCoreTotal = 0;
    let highTierTotal = 0;
    let synergyTotal = 0;
    let mythicTotal = 0;

    for (let i = 0; i < 500; i++) {
      const result = selector.select(pool, budget, intent, 5);
      const nonCore = result.affixes.filter((a) => a.category !== 'core');
      const highTier = nonCore.filter((a) =>
        ['signature', 'synergy', 'mythic'].includes(a.category),
      );
      const synergy = nonCore.filter((a) => a.category === 'synergy');
      const mythic = nonCore.filter((a) => a.category === 'mythic');

      nonCoreTotal += nonCore.length;
      highTierTotal += highTier.length;
      synergyTotal += synergy.length;
      mythicTotal += mythic.length;
    }

    const highTierShare = highTierTotal / Math.max(1, nonCoreTotal);
    const mythicShare = mythicTotal / Math.max(1, nonCoreTotal);

    expect(highTierShare).toBeGreaterThanOrEqual(0.03);
    expect(highTierShare).toBeLessThanOrEqual(0.32);
    expect(synergyTotal).toBeGreaterThan(0);
    expect(mythicTotal).toBeGreaterThan(0);
    expect(mythicShare).toBeLessThanOrEqual(0.12);
  });
});
