import {
  AllowedRaceAdmissionPolicy,
  BaseSectModule,
  type CultivatorSectState,
  type SectBuildBuilder,
  type SectProjectionContext,
  type SectTrialContext,
  type SectTrialScenario,
  type SectTrialScenarioFactory,
} from '../../core';
import { compileLingxiaoBase } from './base/LingxiaoBaseCompiler';
import { LINGXIAO_BASE_DEFINITION } from './definition';
import { LINGXIAO_HEAVY_PATH_MODULE } from './paths/heavy/HeavySwordPathModule';
import { LINGXIAO_SWIFT_PATH_MODULE } from './paths/swift/SwiftSwordPathModule';

const LINGXIAO_TRIAL = {
  methods: { 'lingxiao-canon': 10, 'sword-guidance': 10 },
  abilityLoadout: ['guiding-sword', 'linked-edge', null, null] as const,
  opponentName: '凌霄试剑木人',
};

class LingxiaoTrialScenarioFactory implements SectTrialScenarioFactory {
  create({ cultivator }: SectTrialContext): SectTrialScenario {
    const borrowedSect: CultivatorSectState = {
      membershipId: 'trial',
      sectId: LINGXIAO_BASE_DEFINITION.id,
      status: 'active',
      contribution: 0,
      configVersion: LINGXIAO_BASE_DEFINITION.configVersion,
      methods: { ...LINGXIAO_TRIAL.methods },
      paths: [],
      abilityLoadout: [...LINGXIAO_TRIAL.abilityLoadout],
    };
    return {
      trainee: { ...cultivator, sect: borrowedSect, skills: [] },
      opponent: {
        ...cultivator,
        id: `${cultivator.id ?? 'cultivator'}-${LINGXIAO_BASE_DEFINITION.id}-trial`,
        name: LINGXIAO_TRIAL.opponentName,
        sect: undefined,
        skills: [],
      },
    };
  }
}

/** 凌霄只组合基础传承和两个独立流派，不识别任何流派运行时分支。 */
export class LingxiaoSectModule extends BaseSectModule {
  constructor() {
    super(
      LINGXIAO_BASE_DEFINITION,
      [LINGXIAO_SWIFT_PATH_MODULE, LINGXIAO_HEAVY_PATH_MODULE],
      'plain-sword',
      new AllowedRaceAdmissionPolicy(
        LINGXIAO_BASE_DEFINITION.raceIds,
        '当前种族无法拜入凌霄剑宗',
      ),
      new LingxiaoTrialScenarioFactory(),
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
