import { StandardSectModule } from '../../core/index.js';
import {
  WUXIANG_DEFINITION,
  WUXIANG_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/wuxiang';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_DEFINITION, {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
    });
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
