import type {
  BreakthroughResult,
  CultivationResult,
} from '@shared/engine/cultivation/CultivationEngine';
import type { PlayerStateEvent } from '@shared/contracts/player';

export type RetreatAction = 'cultivate' | 'breakthrough';
export type RetreatStoryType = 'breakthrough' | 'lifespan';

export interface RetreatResultData {
  summary: BreakthroughResult['summary'] | CultivationResult['summary'];
  action: RetreatAction;
  story?: string;
  storyType?: RetreatStoryType | null;
  depleted?: boolean;
}

export type RetreatStreamEvent =
  | {
      type: 'result';
      data: RetreatResultData;
    }
  | {
      type: 'state';
      events: PlayerStateEvent[];
    }
  | {
      type: 'chunk';
      text: string;
    }
  | {
      type: 'error';
      error: string;
    };
