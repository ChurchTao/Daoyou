import type { AffixRarityTone } from './abilityDisplay';

const RARITY_COLORS: Record<AffixRarityTone, string> = {
  muted: 'var(--color-tier-xuan)',
  info: 'var(--color-tier-di)',
  rare: 'var(--color-tier-xian)',
  legendary: 'var(--color-tier-shen)',
};

export function getAffixToneStyle(rarityTone: AffixRarityTone) {
  return {
    color: RARITY_COLORS[rarityTone] ?? RARITY_COLORS.muted,
  };
}

export function getAffixUnderlineStyle(isPerfect: boolean) {
  return {
    borderBottomColor: isPerfect
      ? 'rgba(193, 18, 31, 0.52)'
      : 'rgba(44, 24, 16, 0.18)',
  };
}

export function getPerfectMarkStyle() {
  return {
    color: 'rgba(193, 18, 31, 0.72)',
  };
}
