import { StandardSectModule } from '../../core/index.js';
import { JIUJIE_DEFINITION } from './definition.js';
import { JIUJIE_ORGANIZATION_THEME } from './organization.js';

export class JiujieSectModule extends StandardSectModule {
  constructor() {
    super(JIUJIE_DEFINITION, { organizationTheme: JIUJIE_ORGANIZATION_THEME });
  }
}

export const JIUJIE_MODULE = new JiujieSectModule();
export const JIUJIE_SECT = JIUJIE_MODULE.definition;
