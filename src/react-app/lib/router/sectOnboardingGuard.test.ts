import { describe, expect, it } from 'vitest';
import { resolveSectOnboardingRedirect } from './sectOnboardingGuard';

describe('sect onboarding guard', () => {
  it('waits for sect state and ignores accounts without an active cultivator', () => {
    expect(resolveSectOnboardingRedirect('/game', true, 'loading')).toBeNull();
    expect(resolveSectOnboardingRedirect('/game', false, 'none')).toBeNull();
  });

  it('forces sectless cultivators into the sect world map from unrelated routes', () => {
    expect(resolveSectOnboardingRedirect('/game', true, 'none')).toBe(
      '/game/map?intent=sect',
    );
    expect(resolveSectOnboardingRedirect('/game/inventory', true, 'none')).toBe(
      '/game/map?intent=sect',
    );
  });

  it('allows sectless cultivators to select, inspect, and visit sects', () => {
    expect(
      resolveSectOnboardingRedirect('/game/map', true, 'none', '?intent=sect'),
    ).toBeNull();
    expect(
      resolveSectOnboardingRedirect(
        '/game/sect/onboarding',
        true,
        'none',
        '?sectId=lingxiao',
      ),
    ).toBeNull();
    expect(
      resolveSectOnboardingRedirect('/game/sect/lingxiao/visit', true, 'none'),
    ).toBeNull();
    expect(
      resolveSectOnboardingRedirect('/game/sect/onboarding', true, 'none'),
    ).toBe('/game/map?intent=sect');
  });

  it('only sends existing members away from unscoped onboarding', () => {
    expect(
      resolveSectOnboardingRedirect('/game/sect/onboarding', true, 'joined'),
    ).toBe('/game/sect');
    expect(
      resolveSectOnboardingRedirect('/game/sect/onboarding/', true, 'joined'),
    ).toBe('/game/sect');
    expect(
      resolveSectOnboardingRedirect(
        '/game/sect/onboarding',
        true,
        'joined',
        '?sectId=youdu',
      ),
    ).toBeNull();
    expect(resolveSectOnboardingRedirect('/game', true, 'joined')).toBeNull();
  });
});
