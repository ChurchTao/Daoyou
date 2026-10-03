import type { SectContextData } from '@daoyou/shared/contracts/sect';
import type { SectDiscipleRank } from '@daoyou/shared/engine/sect';
import { productionSectRuntime } from '@daoyou/shared/engine/sect/content';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { findMembership } from '@server/lib/repositories/sectRepository.js';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService.js';
import { SectError } from '@server/sects/application/SectError.js';

@Injectable()
export class SectsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  context(cultivatorId: string) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: cultivatorId },
      'sect.membership',
      async (q) => {
        const membership = await findMembership(cultivatorId, q);
        if (!membership)
          throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 404);
        const organization = productionSectRuntime.registry.require(
          membership.sectId,
        ).organization;
        return {
          sectId: membership.sectId,
          membershipId: membership.id,
          status: membership.status as SectContextData['status'],
          joinedAt: membership.joinedAt?.toISOString(),
          discipleRank:
            membership.discipleRank as SectContextData['discipleRank'],
          contribution: membership.contribution,
          lifetimeContribution: membership.lifetimeContribution,
          office: membership.office as SectContextData['office'],
          promotedAt: membership.promotedAt?.toISOString(),
          permissions: organization.capabilities.snapshot(
            membership.discipleRank as SectDiscipleRank,
          ),
          configVersion: membership.configVersion,
        } satisfies SectContextData;
      },
      this.database,
    );
  }
}
