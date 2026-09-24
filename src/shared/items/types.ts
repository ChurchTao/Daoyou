import type { DaoEquipmentSlot } from '../engine/combat-v6/equipment/types';

export interface ItemDefinition {
  id: string;
  name: string;
  kind:
    | 'beast_book'
    | 'beast_refinement'
    | 'equipment'
    | 'blueprint'
    | 'material'
    | 'manual_jade'
    | 'inscription'
    | 'consumable'
    | 'seed';
  stackLimit: number;
  skillId?: string;
  manualId?: string;
  patternId?: string;
  slot?: DaoEquipmentSlot;
  level?: number;
}
