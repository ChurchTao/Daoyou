import {
  StandardSectModule,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../core';
import { compileYouduBase } from './base/YouduBaseCompiler';
import { YOUDU_BASE_DEFINITION } from './definition';
import { YOUDU_ORGANIZATION_THEME } from './organization';
import { YOUDU_DECREE_PATH_MODULE, YOUDU_TIDE_PATH_MODULE } from './paths';

export class YouduSectModule extends StandardSectModule {
  constructor() {
    super(
      YOUDU_BASE_DEFINITION,
      [YOUDU_TIDE_PATH_MODULE, YOUDU_DECREE_PATH_MODULE],
      { organizationTheme: YOUDU_ORGANIZATION_THEME },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileYouduBase(context, builder);
  }
}

export const YOUDU_MODULE = new YouduSectModule();
export const YOUDU_SECT = YOUDU_MODULE.definition;

