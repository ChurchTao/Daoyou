import { postgresSectOrganizationRepository } from '@server/lib/repositories/SectOrganizationRepositoryPort';
import { getExecutor } from '@server/lib/drizzle/db';
import * as membershipRepository from '@server/lib/repositories/sectRepository';
import {
  addConsumableToInventory,
  getPlayerRuntimeCultivatorByIdUnsafe,
  updateCultivationExp,
} from '@server/lib/services/cultivatorService';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { SectBenefitService } from './SectBenefitService';
import { SectConstructionApplicationService } from './SectConstructionApplicationService';
import { SectEconomyApplicationService } from './SectEconomyApplicationService';
import { SectMembershipApplicationService } from './SectMembershipApplicationService';
import { SectOrganizationFacade } from './SectOrganizationFacade';
import { SectTaskApplicationService } from './SectTaskApplicationService';
import { createSectTaskWorkflow } from './SectTaskWorkflow';

const sharedContext = {
  runtime: productionSectRuntime,
  organizationRepository: postgresSectOrganizationRepository,
  membershipRepository,
};

const benefits = new SectBenefitService(
  productionSectRuntime,
  postgresSectOrganizationRepository,
  membershipRepository,
);

export const sectOrganizationFacade = new SectOrganizationFacade({
  membership: new SectMembershipApplicationService(sharedContext, benefits),
  tasks: new SectTaskApplicationService(
    createSectTaskWorkflow({
      ...sharedContext,
      benefits,
      getPlayer: getPlayerRuntimeCultivatorByIdUnsafe,
      updateCultivationExp,
      simulateBattle: simulateBattleV5,
      getExecutor,
    }),
  ),
  economy: new SectEconomyApplicationService(
    {
      ...sharedContext,
      addMaterial: addMaterialStackToInventory,
      addConsumable: addConsumableToInventory,
      uuid: () => globalThis.crypto.randomUUID(),
    },
    benefits,
  ),
  construction: new SectConstructionApplicationService(sharedContext, benefits),
  benefits,
  getExecutor,
});
