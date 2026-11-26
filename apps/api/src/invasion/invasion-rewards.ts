import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import type { InvasionReward } from '@daoyou/game-domain/invasion';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import {
  INVASION_WAVES_PER_REWARD,
  invasionBossRewardGrade,
  invasionLastWaveResources,
  invasionResourceDelta,
  planInvasionReward,
} from '@daoyou/game-rules/invasion';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { RewardFactory } from '@server/dungeon/application/flow/reward/RewardFactory.js';
import { resolvePlanItems } from '@server/dungeon/application/flow/rewards.js';
import { db } from '@server/lib/drizzle/db.js';
import { cultivators, invasionProgress } from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, asc, eq, lt } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { progressKey, type InvasionProgress } from './invasion-run.js';

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
      // Every payment in the same five-wave group uses the same S-grade roll.
      const paidInGroup = entry.rewardedWave % INVASION_WAVES_PER_REWARD;
      const groupStart = entry.rewardedWave - paidInGroup;
      const bossWave = groupStart + INVASION_WAVES_PER_REWARD;
      const rewardedWave = Math.min(entry.completedWave, bossWave);
      const seed = createHash('sha256')
        .update(`invasion:reward:${week}:${userId}:${bossWave}`)
        .digest();
      const rewardSeed = seed.readUInt32LE(0);
      const planned = planInvasionReward(entry.rewardRealm, rewardSeed, 'S');
      const insight = RewardFactory.rollExorcismInsight(
        entry.rewardRealm,
        planned.insight,
        10,
        planned.difficultyTier,
        () => seed.readUInt32LE(4) / 2 ** 32,
      );
      const budget = { ...planned, insight };
      const resources = invasionResourceDelta(
        budget,
        paidInGroup,
        rewardedWave - groupStart,
      );
      const drops: InvasionReward['drops'] = [];
      const grade =
        rewardedWave === bossWave ? invasionBossRewardGrade(bossWave) : null;
      if (grade) {
        const loot =
          grade === 'S'
            ? planned
            : planInvasionReward(entry.rewardRealm, rewardSeed, grade);
        for (const plan of loot.plans) {
          drops.push(...(await resolvePlanItems(plan, tx)));
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
        resources.spiritStones,
        tx,
      );
      const progress = await updateCultivationExp(
        userId,
        cultivatorId,
        resources.cultivationExp,
        resources.insight,
        tx,
      );
      const settled = {
        cultivationExp: progress.cultivation_exp - previous.cultivation_exp,
        insight:
          progress.comprehension_insight - previous.comprehension_insight,
        spiritStones: spiritStones - character.spirit_stones,
      };
      // A catch-up payment may cover several waves. Earlier waves consume any
      // remaining resource capacity before the wave shown on the rest screen.
      const earlier = invasionResourceDelta(
        budget,
        paidInGroup,
        rewardedWave - groupStart - 1,
      );
      const mail =
        grade && drops.length
          ? await MailService.sendNewRewardMail(
              cultivatorId,
              '古魔入侵·战利品',
              `道友已击退第 ${bossWave} 波古魔，请查收本波战利品。`,
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
          rewardedWave,
          reward: {
            cultivationExp:
              (entry.reward?.cultivationExp ?? 0) + settled.cultivationExp,
            insight: (entry.reward?.insight ?? 0) + settled.insight,
            spiritStones:
              (entry.reward?.spiritStones ?? 0) + settled.spiritStones,
            drops: [...(entry.reward?.drops ?? []), ...drops],
            lastWave: {
              wave: rewardedWave,
              reward: { ...invasionLastWaveResources(settled, earlier), drops },
            },
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
