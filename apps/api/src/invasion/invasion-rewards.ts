import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { DUNGEON_REWARD_PACK } from '@daoyou/game-content/rewards/dungeon';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import type { InvasionReward } from '@daoyou/game-domain/invasion';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import { invasionResourceBudget } from '@daoyou/game-rules/invasion';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  invasionProgress,
  invasionWeeks,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, asc, eq, lt } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { progressKey, type InvasionProgress } from './invasion-run.js';

const superior = DUNGEON_REWARD_PACK.superiorBooks;
const ordinary = DUNGEON_REWARD_PACK.books
  .map(({ rewardId }) => rewardId)
  .filter((id) => !superior.includes(id));

export async function grantPendingInvasionRewards() {
  const pending = await db
    .select()
    .from(invasionProgress)
    .where(lt(invasionProgress.rewardedWave, invasionProgress.completedWave))
    .orderBy(asc(invasionProgress.week), asc(invasionProgress.userId))
    .limit(50);
  for (const entry of pending) {
    try {
      await grantInvasionReward(entry);
    } catch (error) {
      console.error('[invasion] reward settlement failed', {
        week: entry.week,
        userId: entry.userId,
        error,
      });
    }
  }
}

async function grantInvasionReward({
  week,
  userId,
  cultivatorId,
}: InvasionProgress) {
  const { result } = await playerCommandExecutor.execute({
    userId,
    cultivatorId,
    source: 'invasion.settlement',
    coordination: { mode: 'database-only' },
    allowEmpty: true,
    command: async (tx) => {
      const key = progressKey(week, userId);
      const [entry] = await tx
        .select()
        .from(invasionProgress)
        .where(key)
        .for('update');
      if (!entry || entry.rewardedWave >= entry.completedWave)
        return { result: null, resourceChanges: [] };

      const [character] = await tx
        .select()
        .from(cultivators)
        .where(
          and(eq(cultivators.id, cultivatorId), eq(cultivators.userId, userId)),
        );
      if (!character) return { result: null, resourceChanges: [] };
      const total = invasionResourceBudget(
        entry.rewardRealm,
        entry.rewardStage,
        entry.completedWave,
      );
      const paid = invasionResourceBudget(
        entry.rewardRealm,
        entry.rewardStage,
        entry.rewardedWave,
      );
      const drops: InvasionReward['drops'] = [];
      if (
        Math.floor(entry.completedWave / 5) > Math.floor(entry.rewardedWave / 5)
      ) {
        const [event] = await tx
          .select({ materials: invasionWeeks.materials })
          .from(invasionWeeks)
          .where(eq(invasionWeeks.week, week));
        for (
          let boss = Math.floor(entry.rewardedWave / 5) + 1;
          boss <= Math.floor(entry.completedWave / 5);
          boss++
        ) {
          const roll = randomInt(100);
          if (roll < 85)
            drops.push(event.materials[randomInt(event.materials.length)]);
          else {
            const pool = roll < 98 ? ordinary : superior;
            drops.push({
              definitionId: pool[randomInt(pool.length)],
              quantity: 1,
            });
          }
        }
      }
      const previous = getOrInitCultivationProgress(
        (character.cultivation_progress ?? {}) as CultivationProgress,
        character.realm as RealmType,
        character.realm_stage as RealmStage,
      );
      const spiritStones = await updateSpiritStones(
        userId,
        cultivatorId,
        total.spiritStones - paid.spiritStones,
        tx,
      );
      const progress = await updateCultivationExp(
        userId,
        cultivatorId,
        total.cultivationExp - paid.cultivationExp,
        total.insight - paid.insight,
        tx,
      );
      const mail = drops.length
        ? await MailService.sendNewRewardMail(
            cultivatorId,
            '古魔入侵·战利品',
            `道友本期已击退第 ${entry.completedWave} 波古魔，首领战利品随信送上。`,
            rewardAttachments(
              drops.map((inventory) => ({ type: 'inventory_v1', inventory })),
            ),
            'reward',
            tx,
          )
        : null;
      await tx
        .update(invasionProgress)
        .set({
          rewardedWave: entry.completedWave,
          reward: {
            cultivationExp:
              (entry.reward?.cultivationExp ?? 0) +
              progress.cultivation_exp -
              previous.cultivation_exp,
            insight:
              (entry.reward?.insight ?? 0) +
              progress.comprehension_insight -
              previous.comprehension_insight,
            spiritStones:
              (entry.reward?.spiritStones ?? 0) +
              spiritStones -
              character.spirit_stones,
            drops: [...(entry.reward?.drops ?? []), ...drops],
          },
        })
        .where(key);
      return {
        result: mail,
        resourceChanges: [
          {
            resourceTopic: 'player.currency',
            eventType: 'currency.invasion.reward',
            operation: 'merge',
            payload: { spiritStones },
          },
          {
            resourceTopic: 'player.progress',
            eventType: 'progress.invasion.reward',
            operation: 'replace',
            payload: progress,
          },
        ],
      };
    },
  });
  if (result)
    publishTransactionalMessageBestEffort(result.domainEventId, {
      source: 'invasion-reward',
      mailId: result.id,
    });
}
