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
  /** 当前讨伐目标。未选定时队伍仍然存在，选定野外目标后才进入该目标的名单。 */
  event: HuntEvent | null;
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
