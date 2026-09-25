import { db, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, dailyDivinations } from '@server/lib/drizzle/schema';
import { renderPrompt } from '@server/lib/prompts';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { streamAiText } from '@server/utils/aiClient';
import { QI_RESTORE_TALISMAN_SCENARIOS } from '@shared/config/qiSystem';
import type {
  DivinationRecord,
  DivinationStreamEvent,
  DivinationView,
} from '@shared/contracts/divination';
import {
  DIVINATION_DIRECTIONS,
  divinationDayKey,
  divinationRewardFacts,
  fallbackDivination,
  resolveDivination,
  type DivinationDice,
  type DivinationDirection,
} from '@shared/lib/divination';
import { and, eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { assertInventoryIdle, grantInventory } from './InventoryService';
import { publishResourceEvents } from './playerStateBroadcaster';
import { ResourceEventCommitter } from './ResourceEventCommitter';

type Actor = { userId: string; cultivatorId: string };
type Row = typeof dailyDivinations.$inferSelect;
export class DivinationError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 = 409,
  ) {
    super(message);
  }
}
function recordOf(row: Row): DivinationRecord {
  const result = resolveDivination(row.dice);
  return {
    drawId: row.drawId,
    dayKey: row.dayKey,
    direction: row.direction,
    dice: row.dice,
    omen: result.omen,
    total: result.total,
    interpretation: row.interpretation,
    fallback: row.fallback,
    rewardName: QI_RESTORE_TALISMAN_SCENARIOS[result.rewardScenario].label,
    rewardGranted: !!row.rewardGrantedAt,
  };
}
async function lockActor(tx: DbTransaction, actor: Actor) {
  const [owner] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .for('update');
  if (!owner) throw new DivinationError('当前角色不可求签', 404);
}
async function readRow(owner: string) {
  return (
    await db
      .select()
      .from(dailyDivinations)
      .where(eq(dailyDivinations.cultivatorId, owner))
  )[0];
}
export async function readDivination(actor: Actor): Promise<DivinationView> {
  const row = await readRow(actor.cultivatorId);
  const today = divinationDayKey(new Date());
  return {
    today,
    canDraw: !row || (!!row.rewardGrantedAt && row.dayKey !== today),
    record: row ? recordOf(row) : null,
  };
}
export async function drawDivination(
  actor: Actor,
  direction: DivinationDirection,
): Promise<DivinationRecord> {
  return withRedisLock(
    {
      key: redisLockKeys.divination(actor.cultivatorId),
      context: 'divination.draw',
      timeoutMs: 30_000,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockActor(tx, actor);
        const [existing] = await tx
          .select()
          .from(dailyDivinations)
          .where(eq(dailyDivinations.cultivatorId, actor.cultivatorId));
        const today = divinationDayKey(new Date());
        if (
          existing &&
          (existing.dayKey === today || !existing.rewardGrantedAt)
        )
          return recordOf(existing);
        const dice: DivinationDice = [
          randomInt(1, 7),
          randomInt(1, 7),
          randomInt(1, 7),
        ];
        const values = {
          cultivatorId: actor.cultivatorId,
          drawId: randomUUID(),
          dayKey: today,
          direction,
          dice,
          omenId: resolveDivination(dice).omen.id,
          generationId: null,
          interpretation: null,
          fallback: false,
          rewardGrantedAt: null,
          updatedAt: new Date(),
        };
        const [row] = await tx
          .insert(dailyDivinations)
          .values(values)
          .onConflictDoUpdate({
            target: dailyDivinations.cultivatorId,
            set: values,
          })
          .returning();
        lease.assertHeld();
        return recordOf(row);
      }),
  );
}

async function grantReward(
  actor: Actor,
  row: Row,
  outerLease: RedisLeaseContext,
) {
  const committed = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'divination.reward',
      timeoutMs: 30_000,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockActor(tx, actor);
        const [current] = await tx
          .select()
          .from(dailyDivinations)
          .where(eq(dailyDivinations.cultivatorId, actor.cultivatorId))
          .for('update');
        if (
          !current ||
          current.drawId !== row.drawId ||
          current.generationId !== row.generationId
        )
          throw new DivinationError('签文已更新，请重新查看');
        if (current.rewardGrantedAt)
          return {
            record: recordOf(current),
            state: { changes: [], baselines: [] },
          };
        if (!current.interpretation) throw new DivinationError('请先完成解签');
        await assertInventoryIdle(actor.cultivatorId, tx);
        await grantInventory(
          actor.cultivatorId,
          [
            {
              definitionId: 'consumable.v1',
              quantity: 1,
              instanceData: divinationRewardFacts(current.dice),
            },
          ],
          tx,
        );
        const [finished] = await tx
          .update(dailyDivinations)
          .set({ rewardGrantedAt: new Date(), updatedAt: new Date() })
          .where(eq(dailyDivinations.cultivatorId, actor.cultivatorId))
          .returning();
        const state = await new ResourceEventCommitter().commit(tx, {
          actor,
          source: 'daily-divination',
          requestId: row.drawId,
          scopeDefaults: { cultivatorId: actor.cultivatorId },
          changes: [
            {
              resourceTopic: 'inventory.consumables',
              operation: 'invalidate',
              eventType: 'divination.reward.granted',
            },
          ],
        });
        outerLease.assertHeld();
        lease.assertHeld();
        return { record: recordOf(finished), state };
      }),
  );
  publishResourceEvents(committed.state.changes);
  return committed;
}

export async function interpretDivination(
  actor: Actor,
  drawId: string,
  signal: AbortSignal,
  emit: (event: DivinationStreamEvent) => Promise<void>,
) {
  return withRedisLock(
    {
      key: redisLockKeys.divination(actor.cultivatorId),
      context: 'divination.interpret',
      timeoutMs: 30_000,
    },
    async (lease) => {
      let row = await readRow(actor.cultivatorId);
      if (!row || row.drawId !== drawId)
        throw new DivinationError('求签记录已更新，请刷新页面');
      if (row.rewardGrantedAt) {
        await emit({
          type: 'complete',
          record: recordOf(row),
          state: { changes: [], baselines: [] },
        });
        return;
      }
      if (!row.interpretation) {
        // 新租约使用新令牌；旧进程即使晚到，也无法覆盖新解读或发奖。
        const generationId = randomUUID();
        await db.transaction(async (tx) => {
          await lockActor(tx, actor);
          await tx
            .update(dailyDivinations)
            .set({ generationId, updatedAt: new Date() })
            .where(
              and(
                eq(dailyDivinations.cultivatorId, actor.cultivatorId),
                eq(dailyDivinations.drawId, drawId),
              ),
            );
          lease.assertHeld();
        });
        let body = '';
        let fallback = false;
        try {
          const { system, user } = renderPrompt('daily-divination', {
            payloadJson: JSON.stringify({
              direction: DIVINATION_DIRECTIONS.find(
                (item) => item.id === row.direction,
              )?.label,
              dice: row.dice,
              omen: resolveDivination(row.dice).omen,
            }),
          });
          const response = streamAiText({
            system,
            prompt: user,
            sceneId: 'daily-divination',
            abortSignal: signal,
            timeoutMs: 30_000,
            maxOutputTokens: 700,
          });
          for await (const chunk of response.textStream) {
            lease.assertHeld();
            body += chunk;
            if (body.length > 1200) throw new Error('签文超出长度限制');
            await emit({ type: 'text', text: chunk });
          }
          const finishReason = await response.finishReason;
          if (finishReason !== 'stop' || !body.trim() || signal.aborted)
            throw new Error('签文未完整生成');
          body = body.trim();
        } catch (error) {
          lease.assertHeld();
          console.warn('[divination] using preset interpretation', {
            drawId,
            reason: error instanceof Error ? error.name : 'unknown',
          });
          fallback = true;
          body = fallbackDivination(row.direction, row.dice);
        }
        row = await db.transaction(async (tx) => {
          await lockActor(tx, actor);
          const [saved] = await tx
            .update(dailyDivinations)
            .set({ interpretation: body, fallback, updatedAt: new Date() })
            .where(
              and(
                eq(dailyDivinations.cultivatorId, actor.cultivatorId),
                eq(dailyDivinations.drawId, drawId),
                eq(dailyDivinations.generationId, generationId),
              ),
            )
            .returning();
          if (!saved) throw new DivinationError('签文已更新，请重新查看');
          lease.assertHeld();
          return saved;
        });
      }
      await emit({ type: 'interpretation', record: recordOf(row) });
      const committed = await grantReward(actor, row, lease);
      await emit({ type: 'complete', ...committed });
    },
  );
}
