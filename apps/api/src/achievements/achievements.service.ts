import type {
  ClaimAchievementRewardsRequest,
  ClaimAchievementRewardsResult,
} from '@daoyou/contracts/achievements';
import { findAchievementDefinition } from '@daoyou/game-content/achievements';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { updateReputation } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { achievementUnlocks, cultivators } from '@server/lib/drizzle/schema.js';
import { SystemCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  assertSocialAccountsAvailable,
  lockSocialAccounts,
} from '@server/social/application/SocialTransaction.js';
import { enqueueSocialNotification } from '@server/social/social-notifications.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  readAchievementCatalogue,
  syncAchievements,
} from './achievement-ledger.js';

@Injectable()
export class AchievementsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async claim(
    actor: ActiveCultivatorRef,
    input: ClaimAchievementRewardsRequest,
  ) {
    const definitions = input.achievementIds.map((id) => {
      const definition = findAchievementDefinition(id);
      if (!definition) throw new HttpException({ error: '成就不存在' }, 400);
      return definition;
    });
    const execution = await new SystemCommandExecutor(
      this.database,
    ).execute<ClaimAchievementRewardsResult>({
      source: 'achievements.claim',
      actor: { userId: actor.userId, cultivatorId: actor.cultivatorId },
      allowEmpty: true,
      command: async (tx) => {
        await lockSocialAccounts(tx, [actor.userId]);
        await assertSocialAccountsAvailable(tx, [actor.userId]);
        const [owned] = await tx
          .select({ reputation: cultivators.reputation })
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
          throw new HttpException({ error: '当前角色已无法领取成就奖励' }, 409);
        await syncAchievements(tx, actor.cultivatorId);
        const unlocks = await tx
          .select()
          .from(achievementUnlocks)
          .where(
            and(
              eq(achievementUnlocks.cultivatorId, actor.cultivatorId),
              inArray(achievementUnlocks.achievementId, input.achievementIds),
            ),
          );
        if (unlocks.length !== definitions.length)
          throw new HttpException(
            { error: '存在尚未达成的成就，请刷新后重试' },
            409,
          );
        const pending = definitions.filter((definition) =>
          unlocks.some(
            (unlock) =>
              unlock.achievementId === definition.id && !unlock.rewardClaimedAt,
          ),
        );
        const reputationGranted = pending.reduce(
          (sum, definition) => sum + definition.reputationReward,
          0,
        );
        if (!pending.length)
          return {
            result: { claimedIds: [], reputationGranted: 0 },
            resourceChanges: [],
          };
        const reputation = await updateReputation(
          actor.userId,
          actor.cultivatorId,
          reputationGranted,
          tx,
        );
        // Never consume a reward if the currency ceiling would silently truncate it.
        if (reputation - owned.reputation !== reputationGranted)
          throw new HttpException(
            { error: '声望余额接近上限，请消耗部分声望后再领取' },
            409,
          );
        const claimedAt = new Date();
        for (const definition of pending) {
          await tx
            .update(achievementUnlocks)
            .set({
              rewardClaimedAt: claimedAt,
              claimedReputation: definition.reputationReward,
            })
            .where(
              and(
                eq(achievementUnlocks.cultivatorId, actor.cultivatorId),
                eq(achievementUnlocks.achievementId, definition.id),
                isNull(achievementUnlocks.rewardClaimedAt),
              ),
            );
        }
        await enqueueSocialNotification(tx, actor.userId, {
          cultivatorId: actor.cultivatorId,
          kind: 'achievements',
        });
        return {
          result: {
            claimedIds: pending.map((definition) => definition.id),
            reputationGranted,
          },
          resourceChanges: [
            {
              resourceTopic: 'player.currency',
              operation: 'merge',
              eventType: 'achievements.claim',
              scope: { kind: 'cultivator', id: actor.cultivatorId },
              payload: { reputation },
            },
          ],
        };
      },
    });
    return {
      success: true as const,
      data: execution.result,
      state: execution.state,
    };
  }

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
      const synchronized = await syncAchievements(tx, actor.cultivatorId);
      if (synchronized.progressChanged || synchronized.unlockedIds.length) {
        await enqueueSocialNotification(tx, actor.userId, {
          cultivatorId: actor.cultivatorId,
          kind: 'achievements',
        });
      }
      return {
        achievements: await readAchievementCatalogue(tx, actor.cultivatorId),
      };
    });
  }
}
