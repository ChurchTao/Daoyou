import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import type { SectCraftContextKey } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { SectBenefitService } from './SectBenefitService';
import { SectConstructionApplicationService } from './SectConstructionApplicationService';
import { SectEconomyApplicationService } from './SectEconomyApplicationService';
import { SectMembershipApplicationService } from './SectMembershipApplicationService';
import { SectOrganizationFacade } from './SectOrganizationFacade';
import {
  ExecuteSectTaskActionHandler,
  GetSectTasksQueryHandler,
  ProcessSectTaskCompletionHandler,
} from './SectTaskApplicationService';
import { createPostgresSectBenefitContext } from './PostgresSectOrganizationAdapters';
import {
  composeSectOrganizationPlugins,
  CORE_SECT_ORGANIZATION_PLUGIN,
} from './SectOrganizationPlugins';
import { LINGXIAO_SECT_ORGANIZATION_PLUGIN } from './plugins/lingxiao/LingxiaoSectOrganizationPlugin';

const benefits = new SectBenefitService();
const plugins = composeSectOrganizationPlugins({
  organizations: productionSectRuntime.registry.listDefinitions().map((definition) => ({
    sectId: definition.id,
    organization: productionSectRuntime.registry.require(definition.id).organization,
  })),
  manifests: [
    CORE_SECT_ORGANIZATION_PLUGIN,
    LINGXIAO_SECT_ORGANIZATION_PLUGIN,
  ],
});

const application = new SectOrganizationFacade({
  membership: new SectMembershipApplicationService(benefits, plugins.events),
  tasks: {
    queries: new GetSectTasksQueryHandler(plugins.executors, plugins.progress),
    actions: new ExecuteSectTaskActionHandler(
      plugins.executors,
      new ProcessSectTaskCompletionHandler(plugins.events),
    ),
  },
  economy: new SectEconomyApplicationService(
    benefits,
    plugins.rewardGrants,
    plugins.events,
  ),
  construction: new SectConstructionApplicationService(
    benefits,
    plugins.donations,
    plugins.events,
  ),
});

/** Production adapter: binds application ports to an executor at the outer boundary. */
export const sectOrganizationFacade = {
  membership: application.membership,
  tasks: application.tasks,
  economy: application.economy,
  construction: application.construction,
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
