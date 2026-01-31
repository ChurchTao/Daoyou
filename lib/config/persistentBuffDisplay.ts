/**
 * Persistent Buff Display Configuration
 *
 * Defines how persistent buffs should be displayed in the UI,
 * including custom descriptions, navigation paths, and action buttons.
 */

/**
 * Display configuration for a persistent buff
 */
export interface BuffDisplayConfig {
  /** Short description shown below buff name */
  shortDesc?: string;
  /** Navigation path when action button is clicked */
  path?: string;
  /** Text shown on action button */
  action?: string;
  /** Whether to show uses remaining (default: true if has uses) */
  showUses?: boolean;
  /** Whether to show expiry (default: true if has expiry) */
  showExpiry?: boolean;
}

/**
 * Display configuration map for buffs needing special UI handling
 */
const PERSISTENT_BUFF_DISPLAY_CONFIG: Record<string, BuffDisplayConfig> = {
  // Talisman buffs - special handling with navigation
  reshape_fate_talisman: {
    shortDesc: '可窥探三条未来命数',
    path: '/game/fate-reshape',
    action: '推演命格',
    showUses: true,
    showExpiry: true,
  },
  draw_gongfa_talisman: {
    shortDesc: '可领悟功法典籍',
    path: '/game/manual-draw?type=gongfa',
    action: '感悟功法',
    showUses: true,
    showExpiry: true,
  },
  draw_skill_talisman: {
    shortDesc: '可衍化神通秘术',
    path: '/game/manual-draw?type=skill',
    action: '衍化神通',
    showUses: true,
    showExpiry: true,
  },

  // Pill buffs - show but no navigation
  pill_enlightenment_state: {
    shortDesc: '闭关修为获取效率提升',
    showUses: false,
    showExpiry: true,
  },
  pill_insight_state: {
    shortDesc: '闭关感悟获取效率提升',
    showUses: false,
    showExpiry: true,
  },
  breakthrough_luck: {
    shortDesc: '突破成功率提升',
    showUses: false,
    showExpiry: true,
  },

  // Debuff persistent states - show info only
  weakness: {
    shortDesc: '全属性降低，需要疗伤',
    showUses: false,
    showExpiry: false,
  },
  minor_wound: {
    shortDesc: '最大气血降低10%，需要疗伤',
    showUses: false,
    showExpiry: false,
  },
  major_wound: {
    shortDesc: '最大气血大幅降低30%，需要疗伤',
    showUses: false,
    showExpiry: false,
  },
  near_death: {
    shortDesc: '濒死状态，需要紧急疗伤',
    showUses: false,
    showExpiry: false,
  },
};

/**
 * Get display configuration for a buff
 *
 * @param buffId - The buff template ID
 * @returns Display configuration, or undefined for default behavior
 */
export function getBuffDisplayConfig(buffId: string): BuffDisplayConfig | undefined {
  return PERSISTENT_BUFF_DISPLAY_CONFIG[buffId];
}

/**
 * Check if a buff has an action button (navigation)
 *
 * @param buffId - The buff template ID
 * @returns True if the buff has a configured action
 */
export function buffHasAction(buffId: string): boolean {
  const config = PERSISTENT_BUFF_DISPLAY_CONFIG[buffId];
  return !!(config?.action && config.path);
}

/**
 * Get all buffs with special display configurations
 *
 * @returns Map of buff ID to display config
 */
export function getAllBuffDisplayConfigs(): Record<string, BuffDisplayConfig> {
  return { ...PERSISTENT_BUFF_DISPLAY_CONFIG };
}
