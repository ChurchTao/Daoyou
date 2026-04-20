export const EXCLUSIVE_GROUP = {
  ARTIFACT: {
    PANEL_SLOT_WEAPON: 'artifact-panel-slot-weapon',
    PANEL_SLOT_ARMOR: 'artifact-panel-slot-armor',
    PANEL_SLOT_ACCESSORY: 'artifact-panel-slot-accessory',
    PANEL_STAT: 'artifact-panel-stat',
    DEFENSE_CLEANSE: 'artifact-defense-cleanse',
    PANEL_CRIT_RATE: 'artifact-panel-crit-rate',
    PANEL_MOBILITY: 'artifact-panel-mobility',
    PANEL_CRIT_DMG: 'artifact-panel-crit-dmg',
    DEFENSE_ROUND_HEAL: 'artifact-defense-round-heal',
    TREASURE_ULTIMATE: 'artifact-treasure-ultimate',
  },
  GONGFA: {
    FOUNDATION_STAT: 'gongfa-foundation-stat',
    FOUNDATION_DAMAGE_MOD: 'gongfa-foundation-damage-mod',
    SCHOOL_CRIT_DMG: 'gongfa-school-crit-dmg',
    SCHOOL_HEAL: 'gongfa-school-heal',
    SCHOOL_ROUND_HEAL: 'gongfa-school-round-heal',
    SCHOOL_LIFESTEAL: 'gongfa-school-lifesteal',
    SECRET_ULTIMATE: 'gongfa-secret-ultimate',
  },
  SKILL: {
    CORE_DAMAGE_TYPE: 'skill-core-damage-type',
    VARIANT_DAMAGE_BOOST: 'skill-variant-damage-boost',
    VARIANT_BURN: 'skill-variant-burn',
    VARIANT_LIFESTEAL: 'skill-variant-lifesteal',
    RARE_ULTIMATE: 'skill-rare-ultimate',
  },
} as const;

type ValueOf<T> = T extends unknown ? T[keyof T] : never;

export type ExclusiveGroup = ValueOf<ValueOf<typeof EXCLUSIVE_GROUP>>;
