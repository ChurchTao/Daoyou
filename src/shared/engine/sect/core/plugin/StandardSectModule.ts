import { standardSectMethodGrowthPolicy } from '../authoring';
import type {
  CultivatorSectState,
  SectDefinitionWithoutPaths,
  SectTrialContext,
  SectTrialScenario,
} from '../domain';
import { StandardSectRules } from '../domain';
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
    private readonly abilityLoadout = definition.onboarding
      .initialAbilityLoadout,
  ) {
    if (
      this.abilityLoadout.length !== StandardSectRules.activeAbilitySlotCount
    ) {
      throw new Error(
        `宗门 ${definition.id} 试炼神通栏必须包含${StandardSectRules.activeAbilitySlotCount}个固定槽位`,
      );
    }
    for (const [methodId, level] of Object.entries(this.methods)) {
      if (!definition.methods.some((method) => method.id === methodId)) {
        throw new Error(
          `宗门 ${definition.id} 试炼配置引用未知心法 ${methodId}`,
        );
      }
      if (!Number.isInteger(level) || level < 0) {
        throw new Error(`宗门 ${definition.id} 试炼心法等级无效: ${methodId}`);
      }
    }
    const equipped = this.abilityLoadout.filter(
      (abilityId): abilityId is string => abilityId !== null,
    );
    if (new Set(equipped).size !== equipped.length) {
      throw new Error(`宗门 ${definition.id} 试炼神通不可重复`);
    }
    for (const abilityId of equipped) {
      const ability = definition.abilities.find(
        (entry) => entry.id === abilityId,
      );
      if (!ability) {
        throw new Error(
          `宗门 ${definition.id} 试炼配置引用未知能力 ${abilityId}`,
        );
      }
      if (ability.kind !== 'active') {
        throw new Error(
          `宗门 ${definition.id} 试炼配置包含非主动能力 ${abilityId}`,
        );
      }
      if (
        ability.unlock.type === 'method' &&
        (this.methods[ability.unlock.methodId] ?? 0) < ability.unlock.level
      ) {
        throw new Error(
          `宗门 ${definition.id} 试炼配置包含未解锁能力 ${abilityId}`,
        );
      }
      if (ability.unlock.type === 'active_path') {
        throw new Error(
          `宗门 ${definition.id} 试炼配置不得装配流派能力 ${abilityId}`,
        );
      }
    }
    const defaultAbility = definition.abilities.find(
      (ability) => ability.kind === 'default',
    );
    if (
      !defaultAbility ||
      (defaultAbility.unlock.type === 'method' &&
        (this.methods[defaultAbility.unlock.methodId] ?? 0) <
          defaultAbility.unlock.level) ||
      defaultAbility.unlock.type === 'active_path'
    ) {
      throw new Error(`宗门 ${definition.id} 试炼心法配置未解锁默认能力`);
    }
  }

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
