import { describe, expect, it } from '@jest/globals';
import { matchAll } from '@/engine/creation-v2/affixes';
import { estimateBalanceMetrics } from '@/engine/creation-v2/balancing/PBU';
import { RolledAffix } from '@/engine/creation-v2/types';

function affix(
  id: string,
  category: RolledAffix['category'],
  energyCost: number,
): RolledAffix {
  return {
    id,
    name: id,
    category,
    match: matchAll([]),
    tags: [],
    weight: 10,
    energyCost,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
  };
}

describe('PBU baseline', () => {
  it('高品质同配置应有更高 PBU', () => {
    const sample = [affix('core-a', 'skill_core', 10), affix('sig-a', 'skill_rare', 12)];

    const low = estimateBalanceMetrics(sample, '灵品');
    const high = estimateBalanceMetrics(sample, '天品');

    expect(high.pbu).toBeGreaterThan(low.pbu);
    expect(high.channels.damage + high.channels.utility + high.channels.modifier).toBeGreaterThan(0);
  });

  it('高阶类别词缀应抬升 PBU 并进入更快 TTK 分段', () => {
    const low = estimateBalanceMetrics([
      affix('core-a', 'skill_core', 8),
      affix('prefix-a', 'skill_variant', 6),
    ], '灵品');

    const high = estimateBalanceMetrics([
      affix('core-a', 'skill_core', 11),
      affix('signature-a', 'skill_rare', 13),
      affix('mythic-a', 'skill_rare', 16),
    ], '真品');

    expect(high.pbu).toBeGreaterThan(low.pbu);
    expect(low.targetTtkBand).toBe('20+');
    expect(['4-10', '8-20']).toContain(high.targetTtkBand);
  });

  it('中档 PBU 应落入同级对战的 8-20 回合带', () => {
    const mid = estimateBalanceMetrics(
      [
        affix('core-a', 'skill_core', 10),
        affix('signature-a', 'skill_rare', 10),
        affix('suffix-a', 'skill_variant', 9),
      ],
      '玄品',
    );

    expect(mid.targetTtkBand).toBe('8-20');
  });

  it('分项计分应能区分伤害与防御构成', () => {
    const damageBuild = estimateBalanceMetrics(
      [
        affix('skill-core-damage', 'skill_core', 10),
        affix('skill-variant-burn-dot', 'skill_variant', 9),
      ],
      '玄品',
    );
    const defenseBuild = estimateBalanceMetrics(
      [
        affix('artifact-suffix-armor-passive', 'artifact_defense', 8),
        affix('artifact-suffix-death-prevent', 'artifact_defense', 11),
      ],
      '玄品',
    );

    expect(damageBuild.channels.damage).toBeGreaterThan(defenseBuild.channels.damage);
    expect(defenseBuild.channels.defense).toBeGreaterThan(damageBuild.channels.defense);
  });
});
