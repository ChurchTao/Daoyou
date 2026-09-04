export {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
  normalizeInventoryPageParams,
  type InventoryPageParams,
} from './inventoryDefinitions';
export {
  playerCombatV6BuildResource,
  playerConditionResource,
  playerCurrencyResource,
  playerLoadoutResource,
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
  sectProgressionResource,
  sectShopResource,
  sectTasksResource,
  type SectMembersParams,
} from './sectDefinitions';

import {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
} from './inventoryDefinitions';
import {
  playerCombatV6BuildResource,
  playerConditionResource,
  playerCurrencyResource,
  playerLoadoutResource,
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
  sectProgressionResource,
  sectShopResource,
  sectTasksResource,
} from './sectDefinitions';

/** All production definitions are registered here; pages only select them. */
export const resourceRegistry = {
  playerSession: playerSessionResource,
  playerProfile: playerProfileResource,
  playerCondition: playerConditionResource,
  playerProgress: playerProgressResource,
  playerCurrency: playerCurrencyResource,
  playerLoadout: playerLoadoutResource,
  playerCombatV6Build: playerCombatV6BuildResource,
  playerMailSummary: playerMailSummaryResource,
  playerTaskSummary: playerTaskSummaryResource,
  playerTasks: playerTasksResource,
  sectContext: sectContextResource,
  sectMembers: sectMembersResource,
  sectInfrastructure: sectInfrastructureResource,
  sectProgression: sectProgressionResource,
  sectTasks: sectTasksResource,
  sectShop: sectShopResource,
  sectConstructionMember: sectConstructionMemberResource,
  sectContributionRanking: sectContributionRankingResource,
  inventoryArtifacts: inventoryArtifactsResource,
  inventoryMaterials: inventoryMaterialsResource,
  inventoryConsumables: inventoryConsumablesResource,
} as const;
