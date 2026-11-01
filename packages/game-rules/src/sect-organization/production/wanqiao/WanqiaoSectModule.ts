import {
  WANQIAO_DEFINITION,
  WANQIAO_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/wanqiao';
import { StandardSectModule } from '../../core/index.js';

export class WanqiaoSectModule extends StandardSectModule {
  constructor() {
    super(WANQIAO_DEFINITION, { organizationTheme: WANQIAO_ORGANIZATION_THEME });
  }
}

export const WANQIAO_MODULE = new WanqiaoSectModule();
