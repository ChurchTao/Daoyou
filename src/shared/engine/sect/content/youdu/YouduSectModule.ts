import { StandardSectModule } from '../../core';
import { YOUDU_DEFINITION } from './definition';
import { YOUDU_ORGANIZATION_THEME } from './organization';

export class YouduSectModule extends StandardSectModule {
  constructor() {
    super(YOUDU_DEFINITION, { organizationTheme: YOUDU_ORGANIZATION_THEME });
  }
}

export const YOUDU_MODULE = new YouduSectModule();
export const YOUDU_SECT = YOUDU_MODULE.definition;
