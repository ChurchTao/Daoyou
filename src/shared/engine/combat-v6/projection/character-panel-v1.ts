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
    physicalAtk: Math.floor(40 + strength),
    magicAtk: Math.floor(40 + spirit),
    physicalDef: Math.floor(10 + endurance * 2.2),
    magicDef: Math.floor(10 + vitality * 0.4 + strength * 0.6 + spirit * 0.4 + endurance * 0.4 + willpower * 1.6),
    maxHp: Math.floor(400 + vitality * 8),
    maxMp: Math.floor(200 + spirit * 5 + willpower * 5),
    speed: Math.floor(vitality * 0.2 + strength * 0.2 + endurance * 0.2 + speed * 1.5),
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
