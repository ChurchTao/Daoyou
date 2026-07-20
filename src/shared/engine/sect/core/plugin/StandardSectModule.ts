import { standardSectMethodGrowthPolicy } from '../authoring';
import type {
  CultivatorSectState,
  SectDefinitionWithoutPaths,
  SectTrialContext,
  SectTrialScenario,
} from '../domain';
import {
  StandardSectOrganizationModule,
  type SectOrganizationTheme,
} from '../organization';
import { standardSectProgression } from '../progression';
import { BaseSectModule } from './BaseSectModule';
import type { SectPathModule, SectTrialScenarioFactory } from './contracts';
import { AllowedRaceAdmissionPolicy } from './policies';

export interface StandardSectModuleOptions {
  organizationTheme?: SectOrganizationTheme;
  admissionRejectedReason?: string;
  trialOpponentName?: string;
  trialMethods?: Record<string, number>;
  trialAbilityLoadout?: CultivatorSectState['abilityLoadout'];
}

class StandardSectTrialScenarioFactory implements SectTrialScenarioFactory {
  constructor(
    private readonly definition: SectDefinitionWithoutPaths,
    private readonly opponentName: string,
    private readonly methods = definition.onboarding.initialMethods,
    private readonly abilityLoadout = definition.onboarding.initialAbilityLoadout,
  ) {}

  create({ cultivator }: SectTrialContext): SectTrialScenario {
    const borrowedSect: CultivatorSectState = {
      membershipId: `trial:${this.definition.id}`,
      sectId: this.definition.id,
      status: 'active',
      contribution: 0,
      configVersion: this.definition.configVersion,
      methods: { ...this.methods },
      paths: [],
      abilityLoadout: [...this.abilityLoadout],
    };
    return {
      trainee: { ...cultivator, sect: borrowedSect, skills: [] },
      opponent: {
        ...cultivator,
        id: `${cultivator.id ?? 'cultivator'}-${this.definition.id}-trial`,
        name: this.opponentName,
        sect: undefined,
        skills: [],
      },
    };
  }
}

/** 普通宗门聚合根：只要求内容模块提供身份、能力实现与流派。 */
export abstract class StandardSectModule extends BaseSectModule {
  protected constructor(
    definition: SectDefinitionWithoutPaths,
    pathModules: readonly SectPathModule[],
    options: StandardSectModuleOptions = {},
  ) {
    super(
      definition,
      pathModules,
      standardSectProgression,
      standardSectMethodGrowthPolicy,
      new StandardSectOrganizationModule(options.organizationTheme),
      new AllowedRaceAdmissionPolicy(
        definition.raceIds,
        options.admissionRejectedReason ?? `当前种族无法拜入${definition.name}`,
      ),
      new StandardSectTrialScenarioFactory(
        definition,
        options.trialOpponentName ?? `${definition.name}试炼傀儡`,
        options.trialMethods,
        options.trialAbilityLoadout,
      ),
    );
  }
}
