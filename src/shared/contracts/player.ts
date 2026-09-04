import type { ApiSuccess } from '@shared/contracts/http';
import type { CultivationProgress, Cultivator } from '@shared/types/cultivator';
import type { QiProjectionBaseline } from '@shared/types/qi';
import type { CombatV6BuildViewV1 } from './combatV6';
import type {
  ResourceChange,
  ResourceReadMeta,
  ResourceScope,
} from './resources';

export type PlayerLoadout = {
  skills: Cultivator['skills'];
  cultivations: Cultivator['cultivations'];
  artifacts: Cultivator['inventory']['artifacts'];
  equipped: Cultivator['equipped'];
};

export type CultivatorInspectionData = Pick<
  Cultivator,
  | 'id'
  | 'name'
  | 'title'
  | 'gender'
  | 'background'
  | 'description'
  | 'realm'
  | 'realm_stage'
  | 'attributes'
  | 'spiritual_roots'
  | 'pre_heaven_fates'
  | 'cultivations'
  | 'skills'
  | 'equipped'
  | 'condition'
  | 'sect'
> & {
  inventory: Pick<Cultivator['inventory'], 'artifacts'>;
};

export type PlayerIdentityCultivator = Omit<
  Cultivator,
  | 'inventory'
  | 'skills'
  | 'cultivations'
  | 'equipped'
  | 'condition'
  | 'cultivation_progress'
  | 'spirit_stones'
  | 'reputation'
  | 'sect'
  | 'retreat_records'
  | 'breakthrough_history'
  | 'last_yield_at'
> & {
  last_yield_at?: string;
};

export const PLAYER_RESOURCE_KEYS = [
  'session',
  'profile',
  'condition',
  'progress',
  'currency',
  'loadout',
  'combat-v6-build',
  'mail-summary',
  'task-summary',
] as const;

export type PlayerResourceKey = (typeof PLAYER_RESOURCE_KEYS)[number];

export type PlayerSessionResource = {
  activeCultivator: {
    id: string;
    status: 'active';
    sectId: string | null;
  } | null;
  note?: string;
};

export interface PlayerResourceMap {
  session: PlayerSessionResource;
  profile: {
    cultivator: PlayerIdentityCultivator;
  };
  condition: Cultivator['condition'];
  progress: CultivationProgress;
  currency: QiProjectionBaseline & {
    spiritStones: number;
    reputation: number;
  };
  loadout: PlayerLoadout;
  'combat-v6-build': CombatV6BuildViewV1;
  'mail-summary': {
    unreadCount: number;
  };
  'task-summary': {
    activeCount: number;
    claimableCount: number;
  };
}

export type PlayerResourceMutationMeta = {
  changes: ResourceChange[];
  baselines: Array<{
    scope: ResourceScope;
    scopeVersion: number;
  }>;
  replayed?: boolean;
};

export type PlayerStateMutationResponse<TData> = {
  success: true;
  data: TData;
  state: PlayerResourceMutationMeta;
};

export type PlayerResourcesData = {
  cultivatorId: string | null;
  resources: Partial<{
    [TKey in PlayerResourceKey]: {
      data: PlayerResourceMap[TKey];
      resource: ResourceReadMeta<`player.${TKey}`>;
    };
  }>;
  serverTime: string;
};

export type PlayerResourcesResponse = ApiSuccess<PlayerResourcesData>;

export type PlayerResourceEventsData = {
  after: number;
  scope: ResourceScope;
  currentScopeVersion: number;
  earliestAvailableVersion: number;
  changes: ResourceChange[];
  requiresReload: boolean;
};

export type PlayerResourceEventsResponse = ApiSuccess<PlayerResourceEventsData>;
