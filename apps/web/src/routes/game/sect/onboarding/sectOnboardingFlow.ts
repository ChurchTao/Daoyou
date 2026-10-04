export type SectOnboardingFinish =
  { kind: 'join' } | { kind: 'navigate'; href: string };

export function resolveSectOnboardingFinish(
  activeSectId: string | null,
  selectedSectId: string,
): SectOnboardingFinish {
  if (!activeSectId) return { kind: 'join' };
  if (activeSectId === selectedSectId) {
    return { kind: 'navigate', href: '/game/sect' };
  }
  return {
    kind: 'navigate',
    href: `/game/sect/${encodeURIComponent(selectedSectId)}/visit`,
  };
}
