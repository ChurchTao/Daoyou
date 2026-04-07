import { describe, expect, it } from '@jest/globals';
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
    tags: [],
    weight: 10,
    energyCost,
    rollScore: 1,
  };
}

describe('PBU baseline', () => {
  it('高品质同配置应有更高 PBU', () => {
    const sample = [affix('core-a', 'core', 10), affix('sig-a', 'signature', 12)];

    const low = estimateBalanceMetrics(sample, '灵品');
    const high = estimateBalanceMetrics(sample, '天品');

    expect(high.pbu).toBeGreaterThan(low.pbu);
    expect(high.channels.damage + high.channels.utility + high.channels.modifier).toBeGreaterThan(0);
  });

  it('高阶类别词缀应抬升 PBU 并进入更快 TTK 分段', () => {
    const low = estimateBalanceMetrics([
      affix('core-a', 'core', 8),
      affix('prefix-a', 'prefix', 6),
    ], '灵品');

    const high = estimateBalanceMetrics([
      affix('core-a', 'core', 11),
      affix('signature-a', 'signature', 13),
      affix('mythic-a', 'mythic', 16),
    ], '真品');

    expect(high.pbu).toBeGreaterThan(low.pbu);
    expect(['2-3', '3-5']).toContain(high.targetTtkBand);
  });

  it('分项计分应能区分伤害与防御构成', () => {
    const damageBuild = estimateBalanceMetrics(
      [
        affix('skill-core-damage', 'core', 10),
        affix('skill-suffix-burn-dot', 'suffix', 9),
      ],
      '玄品',
    );
    const defenseBuild = estimateBalanceMetrics(
      [
        affix('artifact-suffix-armor-passive', 'suffix', 8),
        affix('artifact-core-death-prevent', 'core', 11),
      ],
      '玄品',
    );

    expect(damageBuild.channels.damage).toBeGreaterThan(defenseBuild.channels.damage);
    expect(defenseBuild.channels.defense).toBeGreaterThan(damageBuild.channels.defense);
  });
});
