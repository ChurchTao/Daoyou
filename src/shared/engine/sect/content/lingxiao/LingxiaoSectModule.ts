import {
  StandardSectModule,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../core';
import { compileLingxiaoBase } from './base/LingxiaoBaseCompiler';
import { LINGXIAO_BASE_DEFINITION } from './definition';
import { LINGXIAO_ORGANIZATION_THEME } from './organization/LingxiaoOrganizationModule';
import { LINGXIAO_HEAVY_PATH_MODULE } from './paths/heavy/HeavySwordPathModule';
import { LINGXIAO_SWIFT_PATH_MODULE } from './paths/swift/SwiftSwordPathModule';

const LINGXIAO_TRIAL = {
  methods: { 'lingxiao-canon': 10, 'sword-guidance': 10 },
  abilityLoadout: ['guiding-sword', 'linked-edge', null, null] as const,
  opponentName: '凌霄试剑木人',
};

/** 凌霄只组合基础传承和两个独立流派，不识别任何流派运行时分支。 */
export class LingxiaoSectModule extends StandardSectModule {
  constructor() {
    super(
      LINGXIAO_BASE_DEFINITION,
      [LINGXIAO_SWIFT_PATH_MODULE, LINGXIAO_HEAVY_PATH_MODULE],
      {
        organizationTheme: LINGXIAO_ORGANIZATION_THEME,
        trialMethods: LINGXIAO_TRIAL.methods,
        trialAbilityLoadout: [...LINGXIAO_TRIAL.abilityLoadout],
        trialOpponentName: LINGXIAO_TRIAL.opponentName,
      },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileLingxiaoBase(context, builder);
  }
}

export const LINGXIAO_MODULE = new LingxiaoSectModule();
export const LINGXIAO_SECT = LINGXIAO_MODULE.definition;
