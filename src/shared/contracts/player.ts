import type { ApiSuccess } from '@shared/contracts/http';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { Cultivator } from '@shared/types/cultivator';

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
