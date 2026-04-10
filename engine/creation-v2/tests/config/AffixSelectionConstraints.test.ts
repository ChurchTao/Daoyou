import {
  ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
  CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES,
  GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE,
  SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE,
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
    tags: [],
    weight: 10,
    energyCost: 5,
    effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
  };
}

describe('AffixSelectionConstraints', () => {
  it('应为所有当前产品类型提供 constraint profile', () => {
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.skill).toBeDefined();
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.artifact).toBeDefined();
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.gongfa).toBeDefined();
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.skill).toBe(
      SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE,
    );
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.artifact).toBe(
      ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
    );
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.gongfa).toBe(
      GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE,
    );
  });

  it('应按候选池可用数量收缩 category caps', () => {
    const constraints = resolveAffixSelectionConstraints('skill', 5, [
      candidate('core-a', 'core'),
      candidate('prefix-a', 'prefix'),
      candidate('signature-a', 'signature'),
    ]);

    expect(constraints.categoryCaps).toMatchObject({
      core: 1,
      prefix: 1,
      suffix: 0,
      signature: 1,
      synergy: 0,
      mythic: 0,
    });
  });

  it('5 槽 profile 应保持单高阶强约束', () => {
    const pool = [
      candidate('core-a', 'core'),
      candidate('prefix-a', 'prefix'),
      candidate('prefix-b', 'prefix'),
      candidate('suffix-a', 'suffix'),
      candidate('suffix-b', 'suffix'),
      candidate('resonance-a', 'resonance'),
      candidate('signature-a', 'signature'),
      candidate('synergy-a', 'synergy'),
      candidate('mythic-a', 'mythic'),
    ];

    expect(resolveAffixSelectionConstraints('skill', 5, pool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        prefix: 2,
        suffix: 2,
      }),
      bucketCaps: { highTierTotal: 1, mythic: 1 },
    });

    expect(resolveAffixSelectionConstraints('artifact', 5, pool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        prefix: 1,
        suffix: 2,
      }),
      bucketCaps: { highTierTotal: 1, mythic: 1 },
    });

    expect(resolveAffixSelectionConstraints('gongfa', 4, pool)).toMatchObject({
      categoryCaps: expect.objectContaining({
        prefix: 1,
        suffix: 2,
        synergy: 0,
      }),
      bucketCaps: { highTierTotal: 1, mythic: 0 },
    });
  });

  it('maxCount 小于等于 0 时应返回全零约束', () => {
    const constraints = resolveAffixSelectionConstraints('gongfa', 0, [
      candidate('core-a', 'core'),
    ]);

    expect(constraints.categoryCaps).toMatchObject({
      core: 0,
      prefix: 0,
      suffix: 0,
      resonance: 0,
      signature: 0,
      synergy: 0,
      mythic: 0,
    });
    expect(constraints.bucketCaps).toEqual({ highTierTotal: 0, mythic: 0 });
  });

  it('各产品类型 profile 应保持独立实例，避免后续调参串扰', () => {
    expect(SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE).not.toBe(
      ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
    );
    expect(ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE).not.toBe(
      GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE,
    );
  });
});