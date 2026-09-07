import type { DaoEquipmentSlot } from '../engine/combat-v6/equipment/types';

export interface ItemDefinition {
  id: string;
  name: string;
  kind: 'beast_book' | 'equipment' | 'blueprint' | 'material';
  stackLimit: number;
  skillId?: string;
  slot?: DaoEquipmentSlot;
  level?: number;
}
