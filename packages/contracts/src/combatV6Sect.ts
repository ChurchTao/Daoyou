import type { SectV6Cost } from '@daoyou/game-domain/sects/commands';

import type { SectCombatProgressV6 } from '@daoyou/game-domain/combat';

import type { SectCombatView } from '@daoyou/game-domain/sects';

export interface SectV6View {
  build: SectCombatView;
  progress: SectCombatProgressV6 | null;
  characterLevel: number;
  resources: SectV6Cost;
  blockedReason: string | null;
}
