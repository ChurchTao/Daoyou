export const EXCLUSIVE_GROUP = {
  ARTIFACT: {
    CORE_SLOT_WEAPON: 'artifact-core-slot-weapon',
    CORE_SLOT_ARMOR: 'artifact-core-slot-armor',
    CORE_SLOT_ACCESSORY: 'artifact-core-slot-accessory',
    CORE_STAT: 'artifact-core-stat',
    CORE_DEFENSE: 'artifact-core-defense',
    PREFIX_CRIT_RATE: 'artifact-prefix-crit-rate',
    PREFIX_MOBILITY: 'artifact-prefix-mobility',
    PREFIX_CRIT_DMG: 'artifact-prefix-crit-dmg',
    SUFFIX_ROUND_HEAL: 'artifact-suffix-round-heal',
    SIGNATURE_ULTIMATE: 'artifact-signature-ultimate',
    MYTHIC_TRANSCENDENT: 'artifact-mythic-transcendent',
  },
  GONGFA: {
    CORE_STAT: 'gongfa-core-stat',
    PREFIX_CRIT_DMG: 'gongfa-prefix-crit-dmg',
    PREFIX_HEAL: 'gongfa-prefix-heal',
    SUFFIX_ROUND_HEAL: 'gongfa-suffix-round-heal',
    SUFFIX_LIFESTEAL: 'gongfa-suffix-lifesteal',
    SIGNATURE_ULTIMATE: 'gongfa-signature-ultimate',
    MYTHIC_TRANSCENDENT: 'gongfa-mythic-transcendent',
  },
  SKILL: {
    CORE_DAMAGE_TYPE: 'skill-core-damage-type',
    PREFIX_DAMAGE_BOOST: 'skill-prefix-damage-boost',
    SUFFIX_BURN: 'skill-suffix-burn',
    SUFFIX_LIFESTEAL: 'skill-suffix-lifesteal',
    SIGNATURE_ULTIMATE: 'skill-signature-ultimate',
    MYTHIC_ULTIMATE: 'skill-mythic-ultimate',
  },
} as const;

type ValueOf<T> = T extends unknown ? T[keyof T] : never;

export type ExclusiveGroup = ValueOf<ValueOf<typeof EXCLUSIVE_GROUP>>;
