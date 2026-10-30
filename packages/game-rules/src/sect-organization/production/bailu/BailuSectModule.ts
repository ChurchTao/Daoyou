import {
  BAILU_DEFINITION,
  BAILU_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/bailu';
import { StandardSectModule } from '../../core/index.js';

export class BailuSectModule extends StandardSectModule {
  constructor() {
    super(BAILU_DEFINITION, { organizationTheme: BAILU_ORGANIZATION_THEME });
  }
}

export const BAILU_MODULE = new BailuSectModule();
