import { StandardSectModule } from '../../core';
import { JIUJIE_DEFINITION } from './definition';
import { JIUJIE_ORGANIZATION_THEME } from './organization';

export class JiujieSectModule extends StandardSectModule {
  constructor() {
    super(JIUJIE_DEFINITION, { organizationTheme: JIUJIE_ORGANIZATION_THEME });
  }
}

export const JIUJIE_MODULE = new JiujieSectModule();
export const JIUJIE_SECT = JIUJIE_MODULE.definition;
