import { describe, expect, it } from 'vitest';
import { resolveSectOnboardingRedirect } from './sectOnboardingGuard';

describe('sect onboarding guard', () => {
  it('waits for sect state and ignores accounts without an active cultivator', () => {
    expect(resolveSectOnboardingRedirect('/game', true, 'loading')).toBeNull();
    expect(resolveSectOnboardingRedirect('/game', false, 'none')).toBeNull();
  });

  it('forces sectless cultivators into onboarding from home and deep links', () => {
    expect(resolveSectOnboardingRedirect('/game', true, 'none')).toBe(
      '/game/sect/onboarding',
    );
    expect(
      resolveSectOnboardingRedirect('/game/inventory', true, 'none'),
    ).toBe('/game/sect/onboarding');
    expect(
      resolveSectOnboardingRedirect('/game/sect/onboarding', true, 'none'),
    ).toBeNull();
  });

  it('sends existing members away from onboarding', () => {
    expect(
      resolveSectOnboardingRedirect('/game/sect/onboarding', true, 'joined'),
    ).toBe('/game/sect');
    expect(
      resolveSectOnboardingRedirect(
        '/game/sect/onboarding/',
        true,
        'joined',
      ),
    ).toBe('/game/sect');
    expect(resolveSectOnboardingRedirect('/game', true, 'joined')).toBeNull();
  });
});
