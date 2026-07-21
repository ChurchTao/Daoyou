import { standardSectMethodGrowthPolicy } from '../authoring';
import type { SectDefinitionWithoutPaths } from '../domain';
import {
  StandardSectOrganizationModule,
  type SectOrganizationTheme,
} from '../organization';
import { standardSectProgression } from '../progression';
import { BaseSectModule } from './BaseSectModule';
import type { SectPathModule } from './contracts';
import { AllowedRaceAdmissionPolicy } from './policies';

export interface StandardSectModuleOptions {
  organizationTheme?: SectOrganizationTheme;
  admissionRejectedReason?: string;
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
    );
  }
}
