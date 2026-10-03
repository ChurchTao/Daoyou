import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import type { SectCraftContextKey } from '@daoyou/shared/engine/sect';
import { productionSectRuntime } from '@daoyou/shared/engine/sect/content';
import { ClaimSectTaskRewardHandler } from '@server/sects/organization/ClaimSectTaskRewardHandler.js';
import { GetSectTasksQueryHandler } from '@server/sects/organization/GetSectTasksQueryHandler.js';
import {
  createPostgresSectAdmissionRepository,
  createPostgresSectAdmissionResourceReader,
  createPostgresSectBenefitContext,
} from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import { SectBenefitService } from '@server/sects/organization/SectBenefitService.js';
import { SectConstructionApplicationService } from '@server/sects/organization/SectConstructionApplicationService.js';
import { SectEconomyApplicationService } from '@server/sects/organization/SectEconomyApplicationService.js';
import { SectMembershipApplicationService } from '@server/sects/organization/SectMembershipApplicationService.js';
import { SectOrganizationFacade } from '@server/sects/organization/SectOrganizationFacade.js';
import {
  CORE_SECT_ORGANIZATION_PLUGIN,
  composeSectOrganizationPlugins,
} from '@server/sects/organization/SectOrganizationPlugins.js';
import {
  ExecuteSectTaskActionHandler,
  FulfillSectTaskHandler,
} from '@server/sects/organization/SectTaskApplicationService.js';
import { SectTaskSubmissionQueryService } from '@server/sects/organization/SectTaskSubmissionQueryService.js';

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
