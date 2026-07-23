import { describe, expect, it } from 'vitest';
import { resolveSectOnboardingFinish } from './sectOnboardingFlow';

describe('sect onboarding finish flow', () => {
  it('only lets sectless cultivators join', () => {
    expect(resolveSectOnboardingFinish(null, 'lingxiao')).toEqual({
      kind: 'join',
    });
  });

  it('returns members to their own full sect map', () => {
    expect(resolveSectOnboardingFinish('lingxiao', 'lingxiao')).toEqual({
      kind: 'navigate',
      href: '/game/sect',
    });
  });

  it('returns foreign members to the visited read-only map', () => {
    expect(resolveSectOnboardingFinish('lingxiao', 'youdu')).toEqual({
      kind: 'navigate',
      href: '/game/sect/youdu/visit',
    });
  });
});
