import { StandardSectModule } from '../../core/index.js';
import {
  JIUJIE_DEFINITION,
  JIUJIE_ORGANIZATION_THEME,
} from '@daoyou/game-content/sect-organization/jiujie';

export class JiujieSectModule extends StandardSectModule {
  constructor() {
    super(JIUJIE_DEFINITION, { organizationTheme: JIUJIE_ORGANIZATION_THEME });
  }
}

export const JIUJIE_MODULE = new JiujieSectModule();
export const JIUJIE_SECT = JIUJIE_MODULE.definition;
