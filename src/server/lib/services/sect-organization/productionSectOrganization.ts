import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import type { SectCraftContextKey } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { ClaimSectTaskRewardHandler } from './ClaimSectTaskRewardHandler';
import { GetSectTasksQueryHandler } from './GetSectTasksQueryHandler';
import {
  createPostgresSectAdmissionRepository,
  createPostgresSectAdmissionResourceReader,
  createPostgresSectBenefitContext,
} from './PostgresSectOrganizationAdapters';
import { SectBenefitService } from './SectBenefitService';
import { SectConstructionApplicationService } from './SectConstructionApplicationService';
import { SectEconomyApplicationService } from './SectEconomyApplicationService';
import { SectMembershipApplicationService } from './SectMembershipApplicationService';
import { SectOrganizationFacade } from './SectOrganizationFacade';
import {
  CORE_SECT_ORGANIZATION_PLUGIN,
  composeSectOrganizationPlugins,
} from './SectOrganizationPlugins';
import {
  ExecuteSectTaskActionHandler,
  FulfillSectTaskHandler,
} from './SectTaskApplicationService';
import { SectTaskSubmissionQueryService } from './SectTaskSubmissionQueryService';

const benefits = new SectBenefitService();
const plugins = composeSectOrganizationPlugins({
  organizations: productionSectRuntime.registry
    .listDefinitions()
    .map((definition) => ({
      sectId: definition.id,
      organization: productionSectRuntime.registry.require(definition.id)
        .organization,
    })),
  manifests: [CORE_SECT_ORGANIZATION_PLUGIN],
});

const fulfillment = new FulfillSectTaskHandler(plugins.events);
export const fulfillSectV6Task = (
  args: Parameters<FulfillSectTaskHandler['execute']>[0],
) => fulfillment.execute(args);
const application = new SectOrganizationFacade({
  membership: new SectMembershipApplicationService(benefits, plugins.events),
  tasks: {
    queries: new GetSectTasksQueryHandler(plugins.executors),
    submissions: new SectTaskSubmissionQueryService(),
    actions: new ExecuteSectTaskActionHandler(
      plugins.executors,
      fulfillment,
      new ClaimSectTaskRewardHandler(plugins.events),
      plugins.offerPolicies,
      plugins.rewardPolicies,
    ),
  },
  economy: new SectEconomyApplicationService(benefits, plugins.events),
  construction: new SectConstructionApplicationService(benefits),
});

/** Production adapter: binds application ports to an executor at the outer boundary. */
export const sectOrganizationFacade = {
  membership: application.membership,
  tasks: application.tasks,
  economy: application.economy,
  construction: application.construction,
  admission(
    q: DbExecutor | DbTransaction = getExecutor(),
    runtime = productionSectRuntime,
  ) {
    const resources = createPostgresSectAdmissionResourceReader({ q });
    return application.createAdmission({
      runtime,
      repository: createPostgresSectAdmissionRepository({ q, runtime }),
      resources,
    });
  },
  getFacilityBonuses(
    cultivatorId: string,
    q: DbExecutor | DbTransaction = getExecutor(),
  ) {
    return benefits.getBonuses(
      cultivatorId,
      createPostgresSectBenefitContext({ q, runtime: productionSectRuntime }),
    );
  },
  applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    craftContext: SectCraftContextKey,
    q: DbExecutor | DbTransaction = getExecutor(),
  ) {
    return benefits.applyCraftDiscount(
      cultivatorId,
      cost,
      craftContext,
      createPostgresSectBenefitContext({ q, runtime: productionSectRuntime }),
    );
  },
};
