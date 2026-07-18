import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import * as organizationRepository from '@server/lib/repositories/sectOrganizationRepository';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import {
  getSectCraftDiscount,
  getSectFacilityBonus,
  type SectDiscipleRank,
} from '@shared/engine/sect';

export async function getSectFacilityBonuses(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const membership = await sectRepository.findMembership(cultivatorId, q);
  if (!membership)
    return { retreatMultiplier: 1, craftDiscount: 0, archiveLevel: 1 };
  const facilities = await organizationRepository.listSectFacilities(
    membership.sectId,
    q,
  );
  const level = (key: string) =>
    facilities.find((item) => item.facilityKey === key)?.level ?? 1;
  return {
    retreatMultiplier:
      1 +
      getSectFacilityBonus(
        'cultivation_room',
        level('cultivation_room'),
      ),
    craftDiscount: getSectCraftDiscount(
      membership.discipleRank as SectDiscipleRank,
      level('workshop'),
    ),
    archiveLevel: level('archive'),
  };
}
