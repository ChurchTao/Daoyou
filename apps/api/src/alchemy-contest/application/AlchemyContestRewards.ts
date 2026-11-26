import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import {
  CONTEST_DURATION_MS,
  type ContestCompletionReward,
} from '@daoyou/game-domain/alchemy/contest';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import { planContestCompletionReward } from '@daoyou/game-rules/alchemy/contest';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import {
  highGradeMaterialQuality,
  libraryMaterialGrant,
  rewardAttachments,
} from '@daoyou/game-rules/rewards/materials';
import { sampleMaterialLibraryEntryDeterministic } from '@server/admin/application/MaterialLibraryService.js';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { RewardFactory } from '@server/dungeon/application/flow/reward/RewardFactory.js';
import { resolvePlanItems } from '@server/dungeon/application/flow/rewards.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  cultivators,
  alchemyContestEntries as entries,
  alchemyContestRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

export async function grantContestCompletion(
  week: string,
  {
    userId,
    cultivatorId,
  }: Pick<ActiveCultivatorRef, 'userId' | 'cultivatorId'>,
) {
  const { result } = await playerCommandExecutor.execute<{
    reward: ContestCompletionReward;
    mail: Awaited<ReturnType<typeof MailService.sendNewRewardMail>> | null;
  } | null>({
    userId,
    cultivatorId,
    source: 'alchemy-contest.completion',
    coordination: { mode: 'database-only' },
    allowEmpty: true,
    command: async (tx) => {
      const skip = { result: null, resourceChanges: [] };
      const [round] = await tx
        .select({ pool: rounds.rewardPool })
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('share');
      if (!round) return skip;
      const key = and(
        eq(entries.week, week),
        eq(entries.userId, userId),
        eq(entries.cultivatorId, cultivatorId),
      );
      const [entry] = await tx.select().from(entries).where(key).for('update');
      if (!entry) return skip;
      if (entry.completionReward)
        return {
          result: { reward: entry.completionReward, mail: null },
          resourceChanges: [],
        };
      const deadline = entry.startedAt.getTime() + CONTEST_DURATION_MS;
      if (!entry.finishedAt && Date.now() < deadline) return skip;
      const { standing } = entry;
      if (!standing) return skip;

      const [character] = await tx
        .select()
        .from(cultivators)
        .where(
          and(eq(cultivators.id, cultivatorId), eq(cultivators.userId, userId)),
        );
      if (!character) return skip;
      const realm = character.realm as RealmType;
      const quality = highGradeMaterialQuality(realm, randomInt(100));
      const herbs = round.pool.materials.filter((item) => {
        const facts = MaterialFactsSchema.safeParse(item.instanceData);
        return (
          item.definitionId === 'material.v1' &&
          item.quantity === 1 &&
          facts.success &&
          facts.data.type === 'herb' &&
          facts.data.rank === quality
        );
      });
      const seed = randomInt(2 ** 32);
      let herb = herbs.length ? herbs[randomInt(herbs.length)] : undefined;
      if (!herb) {
        const fallback = await sampleMaterialLibraryEntryDeterministic(
          {
            materialType: 'herb',
            quality,
            seed: `alchemy-contest:${week}:${userId}:${seed}`,
          },
          tx,
        );
        if (!fallback) throw new Error(`材料库暂无${quality}草药`);
        herb = libraryMaterialGrant(fallback);
      }
      const planned = planContestCompletionReward(realm, standing.score, seed);
      const items = [herb];
      for (const plan of planned.plans)
        items.push(...(await resolvePlanItems(plan, tx)));
      const before = getOrInitCultivationProgress(
        (character.cultivation_progress ?? {}) as CultivationProgress,
        realm,
        character.realm_stage as RealmStage,
      );
      const spiritStones = await updateSpiritStones(
        userId,
        cultivatorId,
        planned.spiritStones,
        tx,
      );
      const progress = await updateCultivationExp(
        userId,
        cultivatorId,
        planned.cultivationExp,
        RewardFactory.rollExorcismInsight(
          realm,
          planned.insight,
          10,
          planned.difficultyTier,
        ),
        tx,
      );
      const reward = {
        grade: planned.grade,
        cultivationExp: progress.cultivation_exp - before.cultivation_exp,
        spiritStones: spiritStones - character.spirit_stones,
        insight: progress.comprehension_insight - before.comprehension_insight,
        items,
      };
      const mail = await MailService.sendNewRewardMail(
        cultivatorId,
        '炼丹大会完赛奖励',
        `道友在本期炼丹大会得 ${standing.score} 分，请查收本场所获。`,
        rewardAttachments(
          items.map((inventory) => ({ type: 'inventory_v1', inventory })),
        ),
        'reward',
        tx,
      );
      await tx
        .update(entries)
        .set({
          finishedAt: entry.finishedAt ?? new Date(deadline),
          completionReward: reward,
        })
        .where(key);
      return {
        result: { reward, mail },
        resourceChanges: [
          {
            resourceTopic: 'player.currency',
            eventType: 'currency.alchemy-contest.reward',
            operation: 'merge',
            payload: { spiritStones },
          },
          {
            resourceTopic: 'player.progress',
            eventType: 'progress.alchemy-contest.reward',
            operation: 'replace',
            payload: progress,
          },
        ],
      };
    },
  });
  if (result?.mail)
    publishTransactionalMessageBestEffort(result.mail.domainEventId, {
      source: 'alchemy-contest-completion-reward',
      mailId: result.mail.id,
    });
  return result?.reward ?? null;
}
