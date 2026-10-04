import type { TowerEnemyRole, TowerFormationId } from './formations.js';

export interface TowerEnemyMember {
  id: string;
  name: string;
  icon: string;
  role: TowerEnemyRole;
  details: string[];
}

export interface TowerEnemyPreview {
  floor: number;
  kind: 'normal' | 'elite' | 'boss';
  name: string;
  icon: string;
  labels: string[];
  details: string[];
  formationId?: TowerFormationId;
  members: TowerEnemyMember[];
}
