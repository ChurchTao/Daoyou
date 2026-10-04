import type { SummonedBeast } from './schema.js';

export type BeastTradePreview = Pick<
  SummonedBeast,
  | 'name'
  | 'speciesId'
  | 'isMutant'
  | 'originKind'
  | 'initialLevel'
  | 'level'
  | 'exp'
  | 'growth'
  | 'aptitudes'
  | 'allocatedAttributes'
  | 'unallocatedPoints'
  | 'skillSlotCapacity'
  | 'skills'
  | 'currentLifespan'
  | 'maxLifespan'
>;


export function beastTradePreview(beast: BeastTradePreview): BeastTradePreview {
  return {
    name: beast.name,
    speciesId: beast.speciesId,
    isMutant: beast.isMutant,
    originKind: beast.originKind,
    initialLevel: beast.initialLevel,
    level: beast.level,
    exp: beast.exp,
    growth: beast.growth,
    aptitudes: beast.aptitudes,
    allocatedAttributes: beast.allocatedAttributes,
    unallocatedPoints: beast.unallocatedPoints,
    skillSlotCapacity: beast.skillSlotCapacity,
    skills: beast.skills,
    currentLifespan: beast.currentLifespan,
    maxLifespan: beast.maxLifespan,
  };
}
