import type { DaoEquipmentSlot } from '../equipment/types.js';

export interface ItemDefinition {
  id: string;
  name: string;
  kind:
    | 'beast_book'
    | 'beast_refinement'
    | 'beast_rejuvenation'
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
