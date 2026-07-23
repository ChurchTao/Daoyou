export type SectOnboardingState = 'loading' | 'none' | 'joined';

export function resolveSectOnboardingRedirect(
  pathname: string,
  hasActiveCultivator: boolean,
  state: SectOnboardingState,
  search = '',
): string | null {
  const onboardingPath = '/game/sect/onboarding';
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search);
  const hasSelectedSect = Boolean(searchParams.get('sectId'));
  const isSectSelectionMap =
    normalizedPath === '/game/map' && searchParams.get('intent') === 'sect';
  const isSectVisit = /^\/game\/sect\/[^/]+\/visit$/.test(normalizedPath);
  if (!hasActiveCultivator || state === 'loading') return null;
  if (
    state === 'none' &&
    !isSectSelectionMap &&
    !isSectVisit &&
    !(normalizedPath === onboardingPath && hasSelectedSect)
  ) {
    return '/game/map?intent=sect';
  }
  if (
    state === 'joined' &&
    normalizedPath === onboardingPath &&
    !hasSelectedSect
  ) {
    return '/game/sect';
  }
  return null;
}
