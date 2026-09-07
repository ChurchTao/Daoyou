import type { DaoEquipmentSlot } from '../engine/combat-v6/equipment/types';
import type { MaterialFacts } from './definitions/materials';

export interface ItemDefinition {
  id: string;
  name: string;
  kind: 'beast_book' | 'equipment' | 'blueprint' | 'material' | 'manual_jade';
  stackLimit: number;
  skillId?: string;
  manualId?: string;
  slot?: DaoEquipmentSlot;
  level?: number;
  material?: MaterialFacts;
}
