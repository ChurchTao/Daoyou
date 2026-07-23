import {
  StandardSectModule,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../core';
import { compileLingxiaoBase } from './base/LingxiaoBaseCompiler';
import { LingxiaoBaseSelectionStrategy } from './base/LingxiaoBaseSelectionStrategy';
import { LINGXIAO_BASE_DEFINITION } from './definition';
import { LINGXIAO_ORGANIZATION_THEME } from './organization/LingxiaoOrganizationModule';
import { LINGXIAO_HEAVY_PATH_MODULE } from './paths/heavy/HeavySwordPathModule';
import { LINGXIAO_SWIFT_PATH_MODULE } from './paths/swift/SwiftSwordPathModule';

/** `lingxiao` 稳定模块只组合红尘剑宗基础传承和两个独立流派。 */
export class LingxiaoSectModule extends StandardSectModule {
  constructor() {
    super(
      LINGXIAO_BASE_DEFINITION,
      [LINGXIAO_SWIFT_PATH_MODULE, LINGXIAO_HEAVY_PATH_MODULE],
      {
        organizationTheme: LINGXIAO_ORGANIZATION_THEME,
      },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileLingxiaoBase(context, builder);
  }

  createBaseSelectionStrategy() {
    return new LingxiaoBaseSelectionStrategy();
  }
}

export const LINGXIAO_MODULE = new LingxiaoSectModule();
export const LINGXIAO_SECT = LINGXIAO_MODULE.definition;
