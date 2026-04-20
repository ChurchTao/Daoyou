import { matchAll } from '@/engine/creation-v2/affixes';
import {
  resolveAffixSelectionConstraints,
} from '@/engine/creation-v2/config/AffixSelectionConstraints';
import type { AffixCandidate } from '@/engine/creation-v2/types';

function candidate(
  id: string,
  category: AffixCandidate['category'],
): AffixCandidate {
  return {
    id,
    name: id,
    category,
    match: matchAll([]),
    tags: [],
    weight: 10,
    energyCost: 5,
    effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
  };
}

describe('AffixSelectionConstraints', () => {
  it('应为所有当前产品类型提供 constraint profile', () => {
    expect(resolveAffixSelectionConstraints('skill', 5, [])).toBeDefined();
    expect(resolveAffixSelectionConstraints('artifact', 5, [])).toBeDefined();
    expect(resolveAffixSelectionConstraints('gongfa', 5, [])).toBeDefined();
  });

  it('应按候选池可用数量收缩 category caps', () => {
    const constraints = resolveAffixSelectionConstraints('skill', 5, [
      candidate('core-a', 'skill_core'),
      candidate('variant-a', 'skill_variant'),
      candidate('rare-a', 'skill_rare'),
    ]);

    expect(constraints.categoryCaps).toMatchObject({
      skill_core: 1,
      skill_variant: 1,
      skill_rare: 1,
    });
  });

  it('5 槽 profile 应保持单高阶强约束', () => {
    const skillPool = [
      candidate('core-a', 'skill_core'),
      candidate('variant-a', 'skill_variant'),
      candidate('variant-b', 'skill_variant'),
      candidate('rare-a', 'skill_rare'),
    ];
    expect(resolveAffixSelectionConstraints('skill', 5, skillPool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        skill_variant: 2,
      }),
      bucketCaps: { highTierTotal: 1 },
    });

    const artifactPool = [
      candidate('panel-a', 'artifact_panel'),
      candidate('defense-a', 'artifact_defense'),
      candidate('defense-b', 'artifact_defense'),
      candidate('treasure-a', 'artifact_treasure'),
    ];
    expect(resolveAffixSelectionConstraints('artifact', 5, artifactPool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        artifact_defense: 2,
      }),
      bucketCaps: { highTierTotal: 1 },
    });

    const gongfaPool = [
      candidate('foundation-a', 'gongfa_foundation'),
      candidate('school-a', 'gongfa_school'),
      candidate('school-b', 'gongfa_school'),
      candidate('secret-a', 'gongfa_secret'),
    ];
    expect(resolveAffixSelectionConstraints('gongfa', 4, gongfaPool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        gongfa_school: 2,
      }),
      bucketCaps: { highTierTotal: 1 },
    });
  });

  it('maxCount 小于等于 0 时应返回全零约束', () => {
    const constraints = resolveAffixSelectionConstraints('gongfa', 0, [
      candidate('core-a', 'gongfa_foundation'),
    ]);

    expect(Object.values(constraints.categoryCaps).every((v) => v === 0)).toBe(true);
    expect(constraints.bucketCaps).toEqual({ highTierTotal: 0 });
  });

  it('各产品类型返回独立约束对象，避免后续调参串扰', () => {
    const skillConstraints = resolveAffixSelectionConstraints('skill', 5, []);
    const artifactConstraints = resolveAffixSelectionConstraints('artifact', 5, []);
    expect(skillConstraints).not.toBe(artifactConstraints);
  });
});