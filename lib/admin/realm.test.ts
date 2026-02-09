import { isRealmInRange } from './realm';

describe('admin realm utils', () => {
  it('checks realm boundaries', () => {
    expect(isRealmInRange('筑基', '炼气', '金丹')).toBe(true);
    expect(isRealmInRange('元婴', '炼气', '金丹')).toBe(false);
  });

  it('handles open range', () => {
    expect(isRealmInRange('大乘')).toBe(true);
    expect(isRealmInRange('炼气', undefined, '金丹')).toBe(true);
    expect(isRealmInRange('渡劫', undefined, '金丹')).toBe(false);
  });
});
