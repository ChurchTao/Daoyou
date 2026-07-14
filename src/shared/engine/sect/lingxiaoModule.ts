import { compileLingxiaoBase } from './combatProjection';
import { LINGXIAO_SECT } from './lingxiao';
import { LINGXIAO_HEAVY_PATH_MODULE } from './lingxiaoHeavyPath';
import { LINGXIAO_SWIFT_PATH_MODULE } from './lingxiaoSwiftPath';
import type { CultivatorSectState, SectModule } from './types';

const LINGXIAO_TRIAL = {
  methods: { 'lingxiao-canon': 10, 'sword-guidance': 10 },
  abilityLoadout: ['guiding-sword', 'linked-edge', null, null] as const,
  opponentName: '凌霄试剑木人',
};

export const LINGXIAO_MODULE: SectModule = {
  definition: LINGXIAO_SECT,
  paths: {
    [LINGXIAO_SWIFT_PATH_MODULE.definition.id]: LINGXIAO_SWIFT_PATH_MODULE,
    [LINGXIAO_HEAVY_PATH_MODULE.definition.id]: LINGXIAO_HEAVY_PATH_MODULE,
  },
  compileBase: compileLingxiaoBase,
  checkAdmission(context) {
    return LINGXIAO_SECT.raceIds.includes(context.playerRace)
      ? { allowed: true }
      : { allowed: false, reason: '当前种族无法拜入凌霄剑宗' };
  },
  createTrialScenario({ cultivator }) {
    const borrowedSect: CultivatorSectState = {
      membershipId: 'trial',
      sectId: LINGXIAO_SECT.id,
      status: 'active',
      contribution: 0,
      configVersion: LINGXIAO_SECT.configVersion,
      methods: { ...LINGXIAO_TRIAL.methods },
      paths: [],
      abilityLoadout: [...LINGXIAO_TRIAL.abilityLoadout],
    };
    return {
      trainee: { ...cultivator, sect: borrowedSect, skills: [] },
      opponent: {
        ...cultivator,
        id: `${cultivator.id ?? 'cultivator'}-${LINGXIAO_SECT.id}-trial`,
        name: LINGXIAO_TRIAL.opponentName,
        sect: undefined,
        skills: [],
      },
    };
  },
};
