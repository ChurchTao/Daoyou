import { StandardSectModule } from '../../core/index.js';
import { WUXIANG_DEFINITION } from './definition.js';
import { WUXIANG_ORGANIZATION_THEME } from './organization.js';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_DEFINITION, {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
    });
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
