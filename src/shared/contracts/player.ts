import type { ApiSuccess } from '@shared/contracts/http';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  Cultivator,
  CultivationProgress,
} from '@shared/types/cultivator';
import type { CultivatorSectState } from '@shared/engine/sect';

export type PlayerLoadout = {
  skills: Cultivator['skills'];
  cultivations: Cultivator['cultivations'];
  artifacts: Cultivator['inventory']['artifacts'];
  equipped: Cultivator['equipped'];
};

export type PlayerProfileCultivator = Omit<
  Cultivator,
  'inventory' | 'skills' | 'cultivations' | 'equipped'
>;

export const PLAYER_STATE_DOMAINS = [
  'profile',
  'condition',
  'progress',
  'currency',
  'loadout',
  'mail',
  'tasks',
  'sect',
] as const;

export type PlayerStateDomain = (typeof PLAYER_STATE_DOMAINS)[number];

export type PlayerStateDomainVersions = Record<PlayerStateDomain, number>;

export type PlayerStateEvent = {
  /**
   * Version fields are sent as JSON numbers while they remain below
   * Number.MAX_SAFE_INTEGER. Migrate these fields to string wire format before
   * any sequence can exceed that bound.
   */
  id: number;
  cultivatorId: string;
  globalVersion: number;
  domainVersion: number;
  domain: PlayerStateDomain;
  eventType: string;
  patch: unknown;
  invalidates: PlayerStateDomain[];
  source: string;
  createdAt: string;
};

export type PlayerStateMutationMeta = {
  cultivatorId: string;
  globalVersion: number;
  domainVersions: Partial<PlayerStateDomainVersions>;
  events: PlayerStateEvent[];
};

export type PlayerStateMutationResponse<TData> = {
  success: true;
  data: TData;
  state: PlayerStateMutationMeta;
};

export type PlayerStateSnapshot = {
  profile: {
    cultivator: PlayerProfileCultivator;
    display: CultivatorDisplaySnapshot;
  };
  condition: Cultivator['condition'];
  progress: CultivationProgress | Record<string, unknown>;
  currency: {
    spiritStones: number;
    reputation: number;
    qi: number;
    qiLastRefreshedAt: string | null;
  };
  loadout: PlayerLoadout;
  mail: {
    unreadCount: number;
  };
  tasks: {
    activeCount: number;
    claimableCount: number;
  };
  sect: CultivatorSectState | null;
};

export type PlayerStateSnapshotData = {
  cultivatorId: string;
  globalVersion: number;
  domainVersions: PlayerStateDomainVersions;
  snapshot: Partial<PlayerStateSnapshot>;
  serverTime: string;
};

export type PlayerStateSnapshotResponse =
  ApiSuccess<PlayerStateSnapshotData>;

export type PlayerStateEventsData = {
  after: number;
  events: PlayerStateEvent[];
  requiresSnapshot: boolean;
};

/**
 * HTTP backfill for WebSocket reconnect/version gaps. This is not an SSE stream.
 */
export type PlayerStateEventsResponse = ApiSuccess<PlayerStateEventsData>;
