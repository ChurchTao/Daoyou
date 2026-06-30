import { describe, expect, it } from 'vitest';
import {
  buildBodyTrackAdvance,
  buildDetoxPower,
  buildLifespanGain,
} from './pillEffectScaling';

describe('pillEffectScaling high quality curves', () => {
  it('makes immortal and divine longevity gains steeper than mid-tier pills', () => {
    expect(buildLifespanGain('天品')).toBe(155);
    expect(buildLifespanGain('仙品')).toBe(240);
    expect(buildLifespanGain('神品')).toBe(320);
  });

  it('makes immortal and divine detox power steeper than mid-tier pills', () => {
    expect(buildDetoxPower('天品')).toBe(52);
    expect(buildDetoxPower('仙品')).toBe(85);
    expect(buildDetoxPower('神品')).toBe(120);
  });

  it('makes immortal and divine body cultivation advances steeper than mid-tier pills', () => {
    expect(buildBodyTrackAdvance('天品')).toBe(96);
    expect(buildBodyTrackAdvance('仙品')).toBe(140);
    expect(buildBodyTrackAdvance('神品')).toBe(210);
  });
});
