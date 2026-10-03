import type { SectRuntime } from '@daoyou/shared/engine/sect';
import type { GetSectTasksQueryHandler } from '@server/sects/organization/GetSectTasksQueryHandler.js';
import { SectAdmissionApplicationService } from '@server/sects/organization/SectAdmissionApplicationService.js';
import type { SectConstructionApplicationService } from '@server/sects/organization/SectConstructionApplicationService.js';
import type { SectEconomyApplicationService } from '@server/sects/organization/SectEconomyApplicationService.js';
import type { SectMembershipApplicationService } from '@server/sects/organization/SectMembershipApplicationService.js';
import type { ExecuteSectTaskActionHandler } from '@server/sects/organization/SectTaskApplicationService.js';
import type { SectTaskSubmissionQueryService } from '@server/sects/organization/SectTaskSubmissionQueryService.js';
import type {
  SectAdmissionRepository,
  SectAdmissionResourceReader,
} from '@server/sects/organization/ports.js';

export interface SectOrganizationServices {
  membership: SectMembershipApplicationService;
  tasks: {
    queries: GetSectTasksQueryHandler;
    submissions: SectTaskSubmissionQueryService;
    actions: ExecuteSectTaskActionHandler;
  };
  economy: SectEconomyApplicationService;
  construction: SectConstructionApplicationService;
}

/** Route-facing composition only; domain decisions remain in the injected services. */
export class SectOrganizationFacade {
  readonly membership: SectMembershipApplicationService;
  readonly tasks: SectOrganizationServices['tasks'];
  readonly economy: SectEconomyApplicationService;
  readonly construction: SectConstructionApplicationService;

  constructor(services: SectOrganizationServices) {
    this.membership = services.membership;
    this.tasks = services.tasks;
    this.economy = services.economy;
    this.construction = services.construction;
  }

  createAdmission(args: {
    runtime: SectRuntime;
    repository: SectAdmissionRepository;
    resources: SectAdmissionResourceReader;
  }): SectAdmissionApplicationService {
    return new SectAdmissionApplicationService(
      args.runtime,
      args.repository,
      args.resources,
    );
  }
}

export type SectOrganizationFacadeInstance = SectOrganizationFacade;
