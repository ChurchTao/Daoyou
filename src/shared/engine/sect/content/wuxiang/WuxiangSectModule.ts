import { StandardSectModule, type SectBuildBuilder, type SectProjectionContext } from '../../core';
import { compileWuxiangBase } from './shared/compiler';
import { WUXIANG_BASE_DEFINITION } from './definition';
import { WUXIANG_ORGANIZATION_THEME } from './organization';
import { WUXIANG_DEMON_PATH_MODULE, WUXIANG_MIRROR_PATH_MODULE } from './paths';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_BASE_DEFINITION, [WUXIANG_MIRROR_PATH_MODULE, WUXIANG_DEMON_PATH_MODULE], {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
    });
  }

  protected compileBase(context: SectProjectionContext, builder: SectBuildBuilder): void {
    compileWuxiangBase(context, builder);
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
