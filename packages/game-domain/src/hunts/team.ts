import type { RealmType } from '@daoyou/constants/realms';
import type { HuntEvent } from './event.js';

export type HuntMember = {
  userId: string;
  cultivatorId: string;
  name: string;
  realm: RealmType;
  ready: boolean;
  assisting: boolean;
};

export type HuntTeam = {
  id: string;
  event: HuntEvent;
  leaderId: string;
  minRealm: RealmType;
  maxRealm: RealmType;
  members: HuntMember[];
  status: 'assembling' | 'starting' | 'in_battle';
  revision: number;
  startRequestId?: string;
  battleId?: string;
  lastBattleId?: string;
};
