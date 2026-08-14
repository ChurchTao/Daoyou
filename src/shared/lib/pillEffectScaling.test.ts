import { describe, expect, it } from 'vitest';
import {
  buildBodyTrackAdvance,
  buildBreakthroughChanceBonus,
  buildDetoxPower,
  buildInsightGain,
  buildLifespanGain,
  buildPillToxicity,
  buildPositivePillToxicity,
  buildProtectMeridiansReduction,
} from './pillEffectScaling';

describe('pillEffectScaling high quality curves', () => {
  it('makes immortal and divine longevity gains steeper than mid-tier pills', () => {
    expect(buildLifespanGain('玄品')).toBe(60);
    expect(buildLifespanGain('真品')).toBe(140);
    expect(buildLifespanGain('地品')).toBe(300);
    expect(buildLifespanGain('天品')).toBe(600);
    expect(buildLifespanGain('仙品')).toBe(1200);
    expect(buildLifespanGain('神品')).toBe(2400);
  });

  it('makes immortal and divine detox power steeper than mid-tier pills', () => {
    expect(buildDetoxPower('天品')).toBe(230);
    expect(buildDetoxPower('仙品')).toBe(380);
    expect(buildDetoxPower('神品')).toBe(600);
  });

  it('makes immortal and divine body cultivation advances steeper than mid-tier pills', () => {
    expect(buildBodyTrackAdvance('天品')).toBe(500);
    expect(buildBodyTrackAdvance('仙品')).toBe(750);
    expect(buildBodyTrackAdvance('神品')).toBe(1100);
  });

  it('uses a post-tier curve for insight, breakthrough and meridian protection', () => {
    expect(buildInsightGain('神品')).toBeGreaterThan(
      buildInsightGain('玄品') * 10,
    );
    expect(buildBreakthroughChanceBonus('神品')).toBeGreaterThan(
      buildBreakthroughChanceBonus('玄品') * 4,
    );
    expect(buildProtectMeridiansReduction('神品')).toBeGreaterThan(
      buildProtectMeridiansReduction('玄品') * 2,
    );
  });

  it('reduces base toxicity by quality and forces perfect pills to one', () => {
    expect(buildPositivePillToxicity('凡品')).toBe(40);
    expect(buildPositivePillToxicity('神品')).toBe(5);
    expect(buildPillToxicity('神品', 'perfect')).toBe(1);
    expect(buildPillToxicity('凡品', 'low')).toBe(54);
  });
});
