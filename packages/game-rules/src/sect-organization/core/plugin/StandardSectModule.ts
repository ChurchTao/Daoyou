import type { SectAdmissionContext, SectDefinition } from '../domain/index.js';
import { StandardSectOrganizationModule } from '../organization/index.js';
import type { SectOrganizationTheme } from '@daoyou/game-domain/sects';
import type { SectModule } from './contracts.js';
import { AllowedRaceAdmissionPolicy } from './policies.js';

export interface StandardSectModuleOptions {
  organizationTheme?: SectOrganizationTheme;
  admissionRejectedReason?: string;
}

export class StandardSectModule implements SectModule {
  readonly organization: StandardSectOrganizationModule;
  private readonly admission: AllowedRaceAdmissionPolicy;

  constructor(
    readonly definition: SectDefinition,
    options: StandardSectModuleOptions = {},
  ) {
    this.organization = new StandardSectOrganizationModule(
      options.organizationTheme,
    );
    this.admission = new AllowedRaceAdmissionPolicy(
      definition.raceIds,
      options.admissionRejectedReason ?? `当前种族无法拜入${definition.name}`,
    );
  }

  checkAdmission(context: SectAdmissionContext) {
    return this.admission.check(context);
  }
}
