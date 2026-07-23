import {
  StandardSectModule,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../core';
import { WUXIANG_BASE_DEFINITION } from './definition';
import { WUXIANG_ORGANIZATION_THEME } from './organization';
import { WUXIANG_DEMON_PATH_MODULE, WUXIANG_MIRROR_PATH_MODULE } from './paths';
import { compileWuxiangBase } from './shared/compiler';
import { WuxiangBaseSelectionStrategy } from './strategy';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(
      WUXIANG_BASE_DEFINITION,
      [WUXIANG_MIRROR_PATH_MODULE, WUXIANG_DEMON_PATH_MODULE],
      {
        organizationTheme: WUXIANG_ORGANIZATION_THEME,
      },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileWuxiangBase(context, builder);
  }

  createBaseSelectionStrategy() {
    return new WuxiangBaseSelectionStrategy();
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
