export type SectOnboardingState = 'loading' | 'none' | 'joined';

export function resolveSectOnboardingRedirect(
  pathname: string,
  hasActiveCultivator: boolean,
  state: SectOnboardingState,
): string | null {
  const onboardingPath = '/game/sect/onboarding';
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (!hasActiveCultivator || state === 'loading') return null;
  if (state === 'none' && normalizedPath !== onboardingPath)
    return onboardingPath;
  if (state === 'joined' && normalizedPath === onboardingPath)
    return '/game/sect';
  return null;
}
