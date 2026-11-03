import {
  XIAOYUE_DEFINITION,
  XIAOYUE_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/xiaoyue';
import { StandardSectModule } from '../../core/index.js';

export class XiaoyueSectModule extends StandardSectModule {
  constructor() {
    super(XIAOYUE_DEFINITION, { organizationTheme: XIAOYUE_ORGANIZATION_THEME });
  }
}

export const XIAOYUE_MODULE = new XiaoyueSectModule();
