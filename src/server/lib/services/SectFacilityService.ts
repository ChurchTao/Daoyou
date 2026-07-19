import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { sectBenefitService } from './sect-organization/SectBenefitService';

export async function getSectFacilityBonuses(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  return sectBenefitService.getBonuses(cultivatorId, q);
}
