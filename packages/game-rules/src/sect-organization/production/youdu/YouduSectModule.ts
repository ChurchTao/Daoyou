import { StandardSectModule } from '../../core/index.js';
import {
  YOUDU_DEFINITION,
  YOUDU_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/youdu';

export class YouduSectModule extends StandardSectModule {
  constructor() {
    super(YOUDU_DEFINITION, { organizationTheme: YOUDU_ORGANIZATION_THEME });
  }
}

export const YOUDU_MODULE = new YouduSectModule();
export const YOUDU_SECT = YOUDU_MODULE.definition;
