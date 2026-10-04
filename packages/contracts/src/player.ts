import type { ApiSuccess } from './http.js';
import type {
  CultivationProgress,
  Cultivator,
} from '@daoyou/game-domain/character';
import type { QiProjectionBaseline } from '@daoyou/game-domain/qi';
import type { SectCombatView } from '@daoyou/game-domain/sects';
import type {
  ResourceChange,
  ResourceReadMeta,
  ResourceScope,
} from './resources/index.js';

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
  | 'condition'
> & {
  combatPanel:
    import('@daoyou/game-domain/combat').CharacterPanelV1 | null;
  build:
    | import('@daoyou/game-domain/combat').PublicCombatV6Build
    | null;
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
  'sect-combat',
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
  condition:
    | (NonNullable<Cultivator['condition']> & {
        combatV6?: import('@daoyou/game-domain/character').CombatV6ResourceAuthority;
      })
    | undefined;
  progress: CultivationProgress;
  currency: QiProjectionBaseline & {
    spiritStones: number;
    reputation: number;
  };
  'sect-combat': SectCombatView;
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
