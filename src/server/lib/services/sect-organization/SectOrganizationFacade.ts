import type { SectConstructionApplicationService } from './SectConstructionApplicationService';
import { SectAdmissionApplicationService } from './SectAdmissionApplicationService';
import { SectTraditionApplicationService } from './SectTraditionApplicationService';
import type { SectRuntime } from '@shared/engine/sect';
import type {
  SectAdmissionRepository,
  SectTraditionRepository,
  SectTrainingResourceGateway,
} from './ports';
import type { SectEconomyApplicationService } from './SectEconomyApplicationService';
import type { SectMembershipApplicationService } from './SectMembershipApplicationService';
import type {
  ExecuteSectTaskActionHandler,
  GetSectTasksQueryHandler,
} from './SectTaskApplicationService';

export interface SectOrganizationServices {
  membership: SectMembershipApplicationService;
  tasks: {
    queries: GetSectTasksQueryHandler;
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
    resources: Pick<SectTrainingResourceGateway, 'load'>;
  }): SectAdmissionApplicationService {
    return new SectAdmissionApplicationService(
      args.runtime,
      args.repository,
      args.resources,
    );
  }

  createTradition(args: {
    runtime: SectRuntime;
    repository: SectTraditionRepository;
    resources: SectTrainingResourceGateway;
  }): SectTraditionApplicationService {
    return new SectTraditionApplicationService(
      args.runtime,
      args.repository,
      args.resources,
    );
  }
}

export type SectOrganizationFacadeInstance = SectOrganizationFacade;
