import { describe, expect, it } from 'vitest';
import {
  TIANYAN_ELEMENTS,
  TIANYAN_REACTION_MATRIX,
  getTianyanReaction,
} from '../shared/reactions';
import { createElementSeal } from '../shared/seals';

describe('天衍五行反应矩阵', () => {
  it('五种形态共用单一受保护法印，不计入普通状态数', () => {
    const seals = TIANYAN_ELEMENTS.map((element) => createElementSeal(element, 2));
    expect(new Set(seals.map((seal) => seal.id))).toEqual(
      new Set(['sect.tianyan.element-seal']),
    );
    for (const seal of seals) {
      expect(seal.duration).toBe(2);
      expect(seal.stackRule).toBe('override');
      expect(seal.dispelPolicy).toBe('protected');
      expect(seal.countsAsStatus).toBe(false);
      expect(seal.statusTags).toHaveLength(1);
    }
  });

  it('恰好覆盖25格且不存在重复组合', () => {
    expect(TIANYAN_REACTION_MATRIX).toHaveLength(25);
    const keys = TIANYAN_REACTION_MATRIX.map(
      (entry) => `${entry.oldSeal}:${entry.incoming}`,
    );
    expect(new Set(keys).size).toBe(25);
    for (const oldSeal of TIANYAN_ELEMENTS) {
      for (const incoming of TIANYAN_ELEMENTS) {
        expect(getTianyanReaction(oldSeal, incoming)).toBeDefined();
      }
    }
  });

  it('包含5续印、5化生、5冲克与10无反应覆盖', () => {
    expect(TIANYAN_REACTION_MATRIX.filter((entry) => entry.kind === 'refresh')).toHaveLength(5);
    expect(TIANYAN_REACTION_MATRIX.filter((entry) => entry.kind === 'generation')).toHaveLength(5);
    expect(TIANYAN_REACTION_MATRIX.filter((entry) => entry.kind === 'overcoming')).toHaveLength(5);
    expect(TIANYAN_REACTION_MATRIX.filter((entry) => entry.kind === 'none')).toHaveLength(10);
  });

  it.each([
    ['wood', 'fire', 'wildfire'],
    ['fire', 'water', 'vaporize'],
    ['water', 'earth', 'quagmire'],
    ['earth', 'wood', 'root-collapse'],
    ['wood', 'metal', 'sever-meridian'],
  ] as const)('%s印遇%s术得到稳定反应%s', (oldSeal, incoming, id) => {
    expect(getTianyanReaction(oldSeal, incoming).id).toBe(id);
  });
});
