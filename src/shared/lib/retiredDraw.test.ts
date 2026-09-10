import { describe, expect, it } from 'vitest';
import { isTalismanScenario } from '../config/talismanScenarios';
import { assertCurrentRewardItem, isRetiredDrawItem } from './retiredDraw';

describe('retired draw production boundary', () => {
  it('rejects both historical manual kinds and their talismans without changing facts', () => {
    for (const value of [
      { type: 'gongfa_manual' },
      { type: 'skill_manual' },
      { spec: { kind: 'talisman', scenario: 'draw_gongfa' } },
      { spec: { kind: 'talisman', scenario: 'draw_skill' } },
    ]) {
      const before = structuredClone(value);
      expect(isRetiredDrawItem(value)).toBe(true);
      expect(() => assertCurrentRewardItem(value)).toThrow('旧版抽取已停用');
      expect(value).toEqual(before);
    }
    expect(isTalismanScenario('draw_gongfa')).toBe(false);
    expect(isTalismanScenario('draw_skill')).toBe(false);
  });
  it('preserves ordinary materials and active talismans', () => {
    for (const value of [
      null,
      { type: 'ore' },
      { type: 'seed' },
      { spec: { kind: 'talisman', scenario: 'friend_mail_send' } },
    ]) {
      expect(() => assertCurrentRewardItem(value)).not.toThrow();
    }
  });
});
