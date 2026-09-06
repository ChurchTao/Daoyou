import type { Attributes } from "@shared/types/cultivator"

export interface CharacterPanelV1 {
  physicalAtk: number
  magicAtk: number
  physicalDef: number
  magicDef: number
  maxHp: number
  maxMp: number
  speed: number
  hit: number
  dodge: number
  healPower: number
  sealHit: number
  sealResist: number
  critRate: number
  spellCritRate: number
  physicalFuryRate: number
}

/** 已通过投影校验的永久六维，编译为 character_panel_v1 裸身面板。 */
export function compileCharacterPanelV1(attributes: Attributes): CharacterPanelV1 {
  const { vitality, strength, spirit, endurance, speed, willpower } = attributes
  return {
    physicalAtk: Math.floor(40 + strength * 3.5),
    magicAtk: Math.floor(40 + spirit * 3.5),
    physicalDef: Math.floor(10 + endurance * 1.75),
    magicDef: Math.floor(10 + willpower * 1.75),
    maxHp: Math.floor(400 + vitality * 20 + endurance * 3),
    maxMp: Math.floor(200 + spirit * 4 + willpower * 10),
    speed: Math.floor(speed),
    hit: Math.floor(80 + speed),
    dodge: Math.floor(speed),
    healPower: Math.floor(vitality * 0.25 + willpower),
    sealHit: Math.floor(spirit * 0.5),
    sealResist: Math.floor(willpower * 0.5),
    critRate: 0.05,
    spellCritRate: 0.05,
    physicalFuryRate: 0,
  }
}
