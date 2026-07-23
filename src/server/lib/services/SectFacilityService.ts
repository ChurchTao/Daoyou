import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';

export async function getSectFacilityBonuses(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const { sectOrganizationFacade } = await import(
    './sect-organization/productionSectOrganization'
  );
  return sectOrganizationFacade.getFacilityBonuses(cultivatorId, q);
}
