import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import {
  assertSocialAccountsAvailable,
  lockSocialAccounts,
} from '@server/social/application/SocialTransaction.js';
import { and, eq } from 'drizzle-orm';
import {
  readAchievementCatalogue,
  syncMentorshipAchievements,
} from './achievement-ledger.js';

@Injectable()
export class AchievementsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(actor: ActiveCultivatorRef) {
    return this.database.transaction(async (tx) => {
      await lockSocialAccounts(tx, [actor.userId]);
      await assertSocialAccountsAvailable(tx, [actor.userId]);
      const [owned] = await tx
        .select({ id: cultivators.id })
        .from(cultivators)
        .where(
          and(
            eq(cultivators.id, actor.cultivatorId),
            eq(cultivators.userId, actor.userId),
            eq(cultivators.status, 'active'),
          ),
        )
        .limit(1);
      if (!owned)
        throw new HttpException({ error: '当前角色已无法查看成就' }, 409);
      await syncMentorshipAchievements(tx, actor.cultivatorId);
      return {
        achievements: await readAchievementCatalogue(tx, actor.cultivatorId),
      };
    });
  }
}
