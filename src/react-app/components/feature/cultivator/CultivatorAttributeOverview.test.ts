import { describe, expect, it } from 'vitest';
import { getAttributeDetailActionLabel } from './attributeActionLabels';

describe('getAttributeDetailActionLabel', () => {
  it('points players to allocation when free attribute points exist', () => {
    expect(getAttributeDetailActionLabel(true)).toBe('去分配属性');
  });

  it('uses the neutral detail label when there are no free attribute points', () => {
    expect(getAttributeDetailActionLabel(false)).toBe('详情');
  });
});
