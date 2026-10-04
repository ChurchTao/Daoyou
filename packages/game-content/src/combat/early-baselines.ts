

// The tower starts at Gold Core. These two baselines extend its encounter budget
// to the realms used by early dungeons, breakthroughs and sect tasks.
export const earlyBaselines = {
  炼气: {
    damagePerRound: 180,
    physicalAtk: 180,
    magicAtk: 200,
    physicalDef: 90,
    magicDef: 100,
    speed: 75,
    hit: 100,
    dodge: 35,
    referencePhysicalDef: 100,
    referenceMagicDef: 110,
  },
  筑基: {
    damagePerRound: 430,
    physicalAtk: 420,
    magicAtk: 460,
    physicalDef: 180,
    magicDef: 210,
    speed: 155,
    hit: 135,
    dodge: 60,
    referencePhysicalDef: 260,
    referenceMagicDef: 290,
  },
} as const;
