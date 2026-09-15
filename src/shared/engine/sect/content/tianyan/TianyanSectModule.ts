import { StandardSectModule } from '../../core';
import { TIANYAN_DEFINITION } from './definition';
import { TIANYAN_ORGANIZATION_THEME } from './organization';

export class TianyanSectModule extends StandardSectModule {
  constructor() {
    super(TIANYAN_DEFINITION, {
      organizationTheme: TIANYAN_ORGANIZATION_THEME,
    });
  }
}

export const TIANYAN_MODULE = new TianyanSectModule();
export const TIANYAN_SECT = TIANYAN_MODULE.definition;
