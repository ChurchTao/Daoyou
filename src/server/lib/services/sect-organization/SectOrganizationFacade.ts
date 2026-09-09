import type { SectRuntime } from '@shared/engine/sect';
import type { GetSectTasksQueryHandler } from './GetSectTasksQueryHandler';
import { SectAdmissionApplicationService } from './SectAdmissionApplicationService';
import type { SectConstructionApplicationService } from './SectConstructionApplicationService';
import type { SectEconomyApplicationService } from './SectEconomyApplicationService';
import type { SectMembershipApplicationService } from './SectMembershipApplicationService';
import type { ExecuteSectTaskActionHandler } from './SectTaskApplicationService';
import type { SectTaskSubmissionQueryService } from './SectTaskSubmissionQueryService';
import type {
  SectAdmissionRepository,
  SectAdmissionResourceReader,
} from './ports';

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
