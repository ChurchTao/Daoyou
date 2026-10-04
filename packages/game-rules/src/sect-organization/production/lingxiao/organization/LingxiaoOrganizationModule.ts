import { LINGXIAO_ORGANIZATION_THEME } from '@daoyou/game-content/sect-organization/lingxiao';
import { StandardSectOrganizationModule } from '../../../core/index.js';


export class LingxiaoOrganizationModule extends StandardSectOrganizationModule {
  constructor() {
    super(LINGXIAO_ORGANIZATION_THEME);
  }
}

export const LINGXIAO_ORGANIZATION = new LingxiaoOrganizationModule();
