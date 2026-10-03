import { StandardSectModule } from '../../core/index.js';
import { LINGXIAO_DEFINITION } from './definition.js';
import { LINGXIAO_ORGANIZATION_THEME } from './organization/LingxiaoOrganizationModule.js';

export class LingxiaoSectModule extends StandardSectModule {
  constructor() {
    super(LINGXIAO_DEFINITION, {
      organizationTheme: LINGXIAO_ORGANIZATION_THEME,
    });
  }
}

export const LINGXIAO_MODULE = new LingxiaoSectModule();
export const LINGXIAO_SECT = LINGXIAO_MODULE.definition;
