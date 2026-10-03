import { StandardSectModule } from '../../core/index.js';
import { YOUDU_DEFINITION } from './definition.js';
import { YOUDU_ORGANIZATION_THEME } from './organization.js';

export class YouduSectModule extends StandardSectModule {
  constructor() {
    super(YOUDU_DEFINITION, { organizationTheme: YOUDU_ORGANIZATION_THEME });
  }
}

export const YOUDU_MODULE = new YouduSectModule();
export const YOUDU_SECT = YOUDU_MODULE.definition;
