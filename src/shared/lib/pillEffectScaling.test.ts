import { describe, expect, it } from 'vitest';
import {
  buildBreakthroughChanceBonus,
  buildBodyTrackAdvance,
  buildDetoxPower,
  buildInsightGain,
  buildLifespanGain,
  buildProtectMeridiansReduction,
} from './pillEffectScaling';

describe('pillEffectScaling high quality curves', () => {
  it('makes immortal and divine longevity gains steeper than mid-tier pills', () => {
    expect(buildLifespanGain('天品')).toBe(240);
    expect(buildLifespanGain('仙品')).toBe(420);
    expect(buildLifespanGain('神品')).toBe(700);
  });

  it('makes immortal and divine detox power steeper than mid-tier pills', () => {
    expect(buildDetoxPower('天品')).toBe(120);
    expect(buildDetoxPower('仙品')).toBe(190);
    expect(buildDetoxPower('神品')).toBe(300);
  });

  it('makes immortal and divine body cultivation advances steeper than mid-tier pills', () => {
    expect(buildBodyTrackAdvance('天品')).toBe(400);
    expect(buildBodyTrackAdvance('仙品')).toBe(650);
    expect(buildBodyTrackAdvance('神品')).toBe(1200);
  });

  it('uses a post-tier curve for insight, breakthrough and meridian protection', () => {
    expect(buildInsightGain('神品')).toBeGreaterThan(buildInsightGain('玄品') * 10);
    expect(buildBreakthroughChanceBonus('神品')).toBeGreaterThan(
      buildBreakthroughChanceBonus('玄品') * 4,
    );
    expect(buildProtectMeridiansReduction('神品')).toBeGreaterThan(
      buildProtectMeridiansReduction('玄品') * 2,
    );
  });
});
