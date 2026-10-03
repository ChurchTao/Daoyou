import { StandardSectModule } from '../../core/index.js';
import { TIANYAN_DEFINITION } from './definition.js';
import { TIANYAN_ORGANIZATION_THEME } from './organization.js';

export class TianyanSectModule extends StandardSectModule {
  constructor() {
    super(TIANYAN_DEFINITION, {
      organizationTheme: TIANYAN_ORGANIZATION_THEME,
    });
  }
}

export const TIANYAN_MODULE = new TianyanSectModule();
export const TIANYAN_SECT = TIANYAN_MODULE.definition;
