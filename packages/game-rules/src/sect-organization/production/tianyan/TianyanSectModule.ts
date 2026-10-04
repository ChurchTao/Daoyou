import { StandardSectModule } from '../../core/index.js';
import {
  TIANYAN_DEFINITION,
  TIANYAN_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/tianyan';

export class TianyanSectModule extends StandardSectModule {
  constructor() {
    super(TIANYAN_DEFINITION, {
      organizationTheme: TIANYAN_ORGANIZATION_THEME,
    });
  }
}

export const TIANYAN_MODULE = new TianyanSectModule();
export const TIANYAN_SECT = TIANYAN_MODULE.definition;
