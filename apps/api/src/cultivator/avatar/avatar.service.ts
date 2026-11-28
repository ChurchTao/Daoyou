import {
  type AvatarCollectionView,
  type AvatarJobView,
  type CreateAvatarInput,
} from '@daoyou/contracts/player/avatar';
import { AVATAR_TALISMAN_SCENARIO } from '@daoyou/game-content/consumables';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { consumeBagConsumable } from '@server/inventory/application/BagConsumables.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  cultivatorAvatars,
  cultivators,
  inventoryItems,
} from '@server/lib/drizzle/schema.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { AvatarRendererService } from './avatar-renderer.service.js';

const PAGE_SIZE = 24;
const JOB_DEADLINE_MS = 15 * 60_000;

@Injectable()
export class AvatarService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(PlayerCommandExecutor)
    private readonly commands: PlayerCommandExecutor,
    @Inject(AvatarRendererService)
    private readonly renderer: AvatarRendererService,
  ) {}

  async collection(
    actor: ActiveCultivatorRef,
    before?: string,
  ): Promise<AvatarCollectionView> {
    const owner = eq(cultivatorAvatars.userId, actor.userId);
    const [cursor] = before
      ? await this.database
          .select({ createdAt: cultivatorAvatars.createdAt })
          .from(cultivatorAvatars)
          .where(
            and(
              owner,
              eq(cultivatorAvatars.id, before),
              eq(cultivatorAvatars.status, 'ready'),
            ),
          )
      : [];
    if (before && !cursor) throw new HttpException('头像收藏游标无效', 400);

    // Fetch the job first so a ready job is already visible in the following collection read.
    const [job] = await this.database
      .select({
        id: cultivatorAvatars.id,
        description: cultivatorAvatars.description,
        status: cultivatorAvatars.status,
        failure: cultivatorAvatars.failure,
        refundLocation: cultivatorAvatars.refundLocation,
      })
      .from(cultivatorAvatars)
      .where(owner)
      .orderBy(desc(cultivatorAvatars.createdAt), desc(cultivatorAvatars.id))
      .limit(1);
    const rows = await this.database
      .select({
        id: cultivatorAvatars.id,
        description: cultivatorAvatars.description,
        createdAt: cultivatorAvatars.createdAt,
      })
      .from(cultivatorAvatars)
      .where(
        and(
          owner,
          eq(cultivatorAvatars.status, 'ready'),
          cursor && before
            ? or(
                lt(cultivatorAvatars.createdAt, cursor.createdAt),
                and(
                  eq(cultivatorAvatars.createdAt, cursor.createdAt),
                  lt(cultivatorAvatars.id, before),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(cultivatorAvatars.createdAt), desc(cultivatorAvatars.id))
      .limit(PAGE_SIZE + 1);
    return {
      generationEnabled: this.renderer.configured,
      latestJob: job ?? null,
      avatars: rows.slice(0, PAGE_SIZE).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
    };
  }

  create(actor: ActiveCultivatorRef, input: CreateAvatarInput) {
    if (!this.renderer.configured)
      throw new HttpException('绘制头像暂未开放', 503);
    return this.commands.executeWithLock<AvatarJobView>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'avatar_create',
      idempotency: {
        key: input.requestId,
        fingerprint: createHash('sha256')
          .update(JSON.stringify(input))
          .digest('hex'),
      },
      command: async (tx) => {
        // The account keeps its collection and may switch active characters.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`avatar:${actor.userId}`}, 0))`,
        );
        const [used] = await tx
          .select({ id: cultivatorAvatars.id })
          .from(cultivatorAvatars)
          .where(
            and(
              eq(cultivatorAvatars.userId, actor.userId),
              or(
                eq(cultivatorAvatars.requestId, input.requestId),
                inArray(cultivatorAvatars.status, [
                  'queued',
                  'generating',
                  'processing',
                ]),
              ),
            ),
          )
          .limit(1);
        if (used)
          throw new HttpException('已有绘制任务，请先查看任务状态', 409);
        const [active] = await tx
          .select({ id: cultivators.id })
          .from(cultivators)
          .where(
            and(
              eq(cultivators.id, actor.cultivatorId),
              eq(cultivators.userId, actor.userId),
              eq(cultivators.status, 'active'),
            ),
          );
        if (!active) throw new HttpException('当前角色已变更', 409);
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.id, input.itemId),
              eq(inventoryItems.cultivatorId, actor.cultivatorId),
              eq(inventoryItems.location, 'bag'),
              eq(inventoryItems.definitionId, 'consumable.v1'),
              eq(inventoryItems.revision, input.revision),
            ),
          )
          .for('update');
        const facts = ConsumableFactsSchema.safeParse(item?.instanceData).data;
        if (
          !facts ||
          facts.spec.kind !== 'talisman' ||
          facts.spec.scenario !== AVATAR_TALISMAN_SCENARIO
        ) {
          throw new HttpException('储物袋中的写影符已变更，请重新选择', 409);
        }
        await consumeBagConsumable(actor.cultivatorId, input.itemId, 1, tx);
        const [job] = await tx
          .insert(cultivatorAvatars)
          .values({
            userId: actor.userId,
            cultivatorId: actor.cultivatorId,
            requestId: input.requestId,
            description: input.description,
            reservedItem: {
              definitionId: 'consumable.v1',
              quantity: 1,
              instanceData: facts,
            },
            deadlineAt: new Date(Date.now() + JOB_DEADLINE_MS),
          })
          .returning({ id: cultivatorAvatars.id });
        return {
          result: {
            id: job.id,
            description: input.description,
            status: 'queued',
            failure: null,
            refundLocation: null,
          },
          resourceChanges: [
            {
              resourceTopic: 'inventory.bag',
              eventType: 'inventory.avatar.reserved',
              operation: 'invalidate',
            },
          ],
        };
      },
    });
  }

  equip(actor: ActiveCultivatorRef, avatarId: string | null) {
    return this.commands.executeWithLock({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'avatar_equip',
      command: async (tx) => {
        if (avatarId) {
          const [owned] = await tx
            .select({ id: cultivatorAvatars.id })
            .from(cultivatorAvatars)
            .where(
              and(
                eq(cultivatorAvatars.id, avatarId),
                eq(cultivatorAvatars.userId, actor.userId),
                eq(cultivatorAvatars.status, 'ready'),
              ),
            );
          if (!owned) throw new HttpException('头像不在你的收藏中', 404);
        }
        const [updated] = await tx
          .update(cultivators)
          .set({ avatarId })
          .where(
            and(
              eq(cultivators.id, actor.cultivatorId),
              eq(cultivators.userId, actor.userId),
              eq(cultivators.status, 'active'),
            ),
          )
          .returning({ id: cultivators.id });
        if (!updated) throw new HttpException('当前角色已变更', 409);
        return {
          result: { avatarId },
          resourceChanges: [
            {
              resourceTopic: 'player.profile',
              eventType: 'player.avatar.equipped',
              operation: 'merge',
              payload: { cultivator: { avatarId } },
            },
          ],
        };
      },
    });
  }
}
