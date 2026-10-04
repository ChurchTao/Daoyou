import type { CultivatorManualStateV1 } from '@daoyou/game-domain/manuals';

import type { RealmType } from '@daoyou/constants/realms';

export interface ManualView {
  realm: RealmType;
  state: CultivatorManualStateV1 | null;
  resources: { experience: number; insight: number; experienceCap: number };
  blockedReason: string | null;
}
