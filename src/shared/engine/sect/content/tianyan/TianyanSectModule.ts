import {
  StandardSectModule,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../core';
import { compileTianyanBase } from './base/TianyanBaseCompiler';
import { TIANYAN_BASE_DEFINITION } from './definition';
import { TIANYAN_ORGANIZATION_THEME } from './organization';
import {
  TIANYAN_HETU_PATH_MODULE,
  TIANYAN_LUOSHU_PATH_MODULE,
} from './paths';

export class TianyanSectModule extends StandardSectModule {
  constructor() {
    super(
      TIANYAN_BASE_DEFINITION,
      [TIANYAN_HETU_PATH_MODULE, TIANYAN_LUOSHU_PATH_MODULE],
      { organizationTheme: TIANYAN_ORGANIZATION_THEME },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileTianyanBase(context, builder);
  }
}

export const TIANYAN_MODULE = new TianyanSectModule();
export const TIANYAN_SECT = TIANYAN_MODULE.definition;
