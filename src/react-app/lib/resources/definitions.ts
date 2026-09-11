export {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
  normalizeInventoryPageParams,
  type InventoryPageParams,
} from './inventoryDefinitions';
export {
  playerSectCombatResource,
  playerConditionResource,
  playerCurrencyResource,
  playerMailSummaryResource,
  playerProfileResource,
  playerProgressResource,
  playerSessionResource,
  playerTaskSummaryResource,
  playerTasksResource,
  type PlayerTasksParams,
} from './playerDefinitions';
export {
  sectConstructionMemberResource,
  sectContributionRankingResource,
  sectContextResource,
  sectInfrastructureResource,
  sectMembersResource,
  sectShopResource,
  sectTasksResource,
  type SectMembersParams,
} from './sectDefinitions';

import { inventoryBagResource } from './bag';
import {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
} from './inventoryDefinitions';
import {
  playerSectCombatResource,
  playerConditionResource,
  playerCurrencyResource,
  playerMailSummaryResource,
  playerProfileResource,
  playerProgressResource,
  playerSessionResource,
  playerTaskSummaryResource,
  playerTasksResource,
} from './playerDefinitions';
import {
  sectConstructionMemberResource,
  sectContributionRankingResource,
  sectContextResource,
  sectInfrastructureResource,
  sectMembersResource,
  sectShopResource,
  sectTasksResource,
} from './sectDefinitions';

/** All production definitions are registered here; pages only select them. */
export const resourceRegistry = {
  inventoryBag: inventoryBagResource,
  playerSession: playerSessionResource,
  playerProfile: playerProfileResource,
  playerCondition: playerConditionResource,
  playerProgress: playerProgressResource,
  playerCurrency: playerCurrencyResource,
  playerCombatV6Build: playerSectCombatResource,
  playerMailSummary: playerMailSummaryResource,
  playerTaskSummary: playerTaskSummaryResource,
  playerTasks: playerTasksResource,
  sectContext: sectContextResource,
  sectMembers: sectMembersResource,
  sectInfrastructure: sectInfrastructureResource,
  sectTasks: sectTasksResource,
  sectShop: sectShopResource,
  sectConstructionMember: sectConstructionMemberResource,
  sectContributionRanking: sectContributionRankingResource,
  inventoryArtifacts: inventoryArtifactsResource,
  inventoryMaterials: inventoryMaterialsResource,
  inventoryConsumables: inventoryConsumablesResource,
} as const;
