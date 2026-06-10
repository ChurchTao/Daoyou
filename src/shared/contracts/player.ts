import type { ApiSuccess } from '@shared/contracts/http';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  Cultivator,
  CultivationProgress,
  Inventory,
} from '@shared/types/cultivator';

export type PlayerCultivatorView = {
  cultivator: Cultivator;
  display: CultivatorDisplaySnapshot;
};

export type PlayerActiveData = {
  activeCultivator: PlayerCultivatorView | null;
  cultivators: PlayerCultivatorView[];
  unreadMailCount: number;
};

export type PlayerActiveMeta = {
  hasActive: boolean;
  hasDead: boolean;
};

export type PlayerActiveResponse = ApiSuccess<PlayerActiveData, PlayerActiveMeta>;

export const PLAYER_STATE_DOMAINS = [
  'profile',
  'condition',
  'progress',
  'currency',
  'inventory',
  'products',
  'mail',
  'tasks',
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
    cultivator: Cultivator;
    display: CultivatorDisplaySnapshot;
  };
  condition: Cultivator['condition'];
  progress: CultivationProgress | Record<string, unknown>;
  currency: {
    spiritStones: number;
    qi: number;
    qiLastRefreshedAt: string | null;
  };
  inventory: Inventory;
  products: {
    skills: Cultivator['skills'];
    cultivations: Cultivator['cultivations'];
    artifacts: Cultivator['inventory']['artifacts'];
    equipped: Cultivator['equipped'];
  };
  mail: {
    unreadCount: number;
  };
  tasks: {
    activeCount: number;
    claimableCount: number;
  };
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

export type PlayerStateStreamPayload = {
  events?: PlayerStateEvent[];
  requiresSnapshot?: boolean;
};

export type PlayerStateEventsResponse = ApiSuccess<PlayerStateEventsData>;
