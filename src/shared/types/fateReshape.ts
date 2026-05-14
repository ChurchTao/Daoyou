import type { PreHeavenFate } from './cultivator';

export interface FateReshapeSessionStore {
  sessionId: string;
  cultivatorId: string;
  originalFates: PreHeavenFate[];
  currentCandidates: PreHeavenFate[];
  rerollUsed: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface FateReshapeSessionDTO {
  sessionId: string;
  originalFates: PreHeavenFate[];
  currentCandidates: PreHeavenFate[];
  rerollUsed: boolean;
  canReroll: boolean;
  createdAt: number;
  expiresAt: number;
}
