/** Bump whenever estimates, weights or tie-breaking change. Frozen with battle versions. */
export const AUTO_POLICY_VERSION = 'combat_auto_utility_v1' as const;

export const AUTO_POLICIES = {
  balanced: { offense: 1, survival: 1.2, control: 1, economy: 0.5 },
  aggressive: { offense: 1.4, survival: 0.8, control: 0.8, economy: 0.2 },
  conservative: { offense: 0.8, survival: 1.5, control: 1, economy: 1.2 },
} as const;
export type AutoPolicy = keyof typeof AUTO_POLICIES;
