import { StandardSectModule } from '../../core';
import { WUXIANG_DEFINITION } from './definition';
import { WUXIANG_ORGANIZATION_THEME } from './organization';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_DEFINITION, {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
    });
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
