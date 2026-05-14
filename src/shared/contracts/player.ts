import type { ApiSuccess } from '@shared/contracts/http';
import type { Cultivator } from '@shared/types/cultivator';

export type PlayerActiveData = {
  activeCultivator: Cultivator | null;
  cultivators: Cultivator[];
  unreadMailCount: number;
};

export type PlayerActiveMeta = {
  hasActive: boolean;
  hasDead: boolean;
};

export type PlayerActiveResponse = ApiSuccess<PlayerActiveData, PlayerActiveMeta>;
