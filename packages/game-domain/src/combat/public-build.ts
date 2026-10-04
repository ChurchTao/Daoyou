import type { CharacterCombatInput } from './projection.js';
import type { ManualSlotV1 } from '../manuals/types.js';

/** Equipped, usable build facts exposed to other players. */
export interface PublicCombatV6Build {
  sectName: string | null;
  pathName: string | null;
  equipment: CharacterCombatInput['equipment'];
  manuals: { level: number; slot: ManualSlotV1; manualId: string }[];
  skills: {
    category: 'spell' | 'art';
    description: string;
    id: string;
    name: string;
    level: number;
  }[];
}
