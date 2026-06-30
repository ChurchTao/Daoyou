import { describe, expect, it } from 'vitest';
import {
  adjustAttributeDraftValue,
  canSubmitAttributeAllocation,
  createEmptyAttributeDraft,
  normalizeAttributeDraftValue,
  setAttributeDraftValue,
  sumAttributeDraft,
} from './attributeAllocationControlLogic';

describe('AttributeAllocationControl logic', () => {
  it('normalizes draft input to non-negative integers', () => {
    expect(normalizeAttributeDraftValue(3.8)).toBe(3);
    expect(normalizeAttributeDraftValue(-2)).toBe(0);
    expect(normalizeAttributeDraftValue(Number.NaN)).toBe(0);
  });

  it('updates and adjusts one attribute without mutating the draft', () => {
    const draft = createEmptyAttributeDraft();
    const next = setAttributeDraftValue(draft, 'vitality', 5);
    const adjusted = adjustAttributeDraftValue(next, 'vitality', -2);

    expect(draft.vitality).toBe(0);
    expect(next.vitality).toBe(5);
    expect(adjusted.vitality).toBe(3);
  });

  it('checks pending points against available points and loading state', () => {
    const draft = {
      ...createEmptyAttributeDraft(),
      spirit: 2,
      wisdom: 1,
    };

    expect(sumAttributeDraft(draft)).toBe(3);
    expect(
      canSubmitAttributeAllocation({ draft, unallocatedPoints: 3 }),
    ).toBe(true);
    expect(
      canSubmitAttributeAllocation({ draft, unallocatedPoints: 2 }),
    ).toBe(false);
    expect(
      canSubmitAttributeAllocation({ draft, unallocatedPoints: 3, loading: true }),
    ).toBe(false);
    expect(
      canSubmitAttributeAllocation({
        draft: createEmptyAttributeDraft(),
        unallocatedPoints: 3,
      }),
    ).toBe(false);
  });
});
