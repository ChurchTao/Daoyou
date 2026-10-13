import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type {
  RedPacketClaimDTO,
  RedPacketDetails,
  RedPacketSummary,
  WorldChatCreateMessageRequest,
} from '@daoyou/contracts/world-chat';
import {
  allocateRedPacketAmounts,
  validateRedPacketInput,
} from '@daoyou/game-rules/social/red-packets';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  db,
  type DbClient,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  chatRedPacketClaims,
  chatRedPackets,
  cultivators,
  sectMemberships,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import {
  checkAndAcquireCooldown,
  checkAndAcquireSectChatCooldown,
  getChatCooldownRemaining,
} from '@server/lib/redis/worldChatLimiter.js';
import {
  insertChatMessage,
  queueChatNotification,
  redPacketSummary,
} from '@server/lib/repositories/chatRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import {
  PlayerCommandExecutor,
  SystemCommandExecutor,
} from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { ChatError, chatRequestFingerprint } from './chatError.js';
import { textFilter } from './textFilter.js';

type PacketRow = typeof chatRedPackets.$inferSelect;
type RedPacketRequest = Extract<
  WorldChatCreateMessageRequest,
  { messageType: 'red_packet' }
>;
type PacketScope = { channel: 'world' | 'sect'; sectId: string | null };
const BALANCE_CEILING = 1_000_000_000;

function currencyChange(
  cultivatorId: string,
  spiritStones: number,
): ResourceChangeDescriptor {
  return {
    scope: { kind: 'cultivator', id: cultivatorId },
    resourceTopic: 'player.currency',
    eventType: 'currency.chat.red_packet.changed',
    operation: 'merge',
    payload: { spiritStones },
  };
}

async function requireActiveActor(
  actor: ActiveCultivatorRef,
  tx: DbTransaction,
) {
  const [row] = await tx
    .select()
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) throw new ChatError('当前角色已变化，请刷新后重试', 409);
  return row;
}

async function requirePacketAccess(
  actor: ActiveCultivatorRef,
  scope: PacketScope,
  tx: DbTransaction,
) {
  if (scope.channel !== 'sect') return;
  const [membership] = await tx
    .select({ id: sectMemberships.id })
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.cultivatorId, actor.cultivatorId),
        eq(sectMemberships.sectId, scope.sectId!),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) throw new ChatError('已不在该宗门，无法领取或查看红包', 403);
}

async function exactCurrency(
  tx: DbTransaction,
  actor: { userId: string; cultivatorId: string },
  delta: number,
) {
  if (!Number.isSafeInteger(delta)) throw new ChatError('灵石金额必须为整数');
  const [row] = await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} + ${delta}` })
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
        sql`${cultivators.spirit_stones} + ${delta} >= 0`,
        sql`${cultivators.spirit_stones} + ${delta} <= ${BALANCE_CEILING}`,
      ),
    )
    .returning({ balance: cultivators.spirit_stones });
  if (!row)
    throw new ChatError(
      delta < 0 ? '灵石不足，红包未发出' : '余额已达上限，未领取',
      409,
    );
  return row.balance;
}

async function lockPacket(tx: DbTransaction, id: string) {
  const [packet] = await tx
    .select()
    .from(chatRedPackets)
    .where(eq(chatRedPackets.id, id))
    .for('update')
    .limit(1);
  if (!packet) throw new ChatError('红包不存在', 404);
  return packet;
}

async function queuePacketUpdate(tx: DbTransaction, packet: PacketRow) {
  return queueChatNotification(tx, {
    destination: 'daoyou.realtime.red-packets',
    payload: {
      channel: packet.channel,
      sectId: packet.sectId,
      packet: redPacketSummary(packet),
    },
    deduplicationKey: `packet:${packet.id}:${packet.revision}`,
  });
}

export class RedPacketService {
  private readonly players: PlayerCommandExecutor;
  private readonly systems: SystemCommandExecutor;
  constructor(private readonly database: DbClient = db) {
    this.players = new PlayerCommandExecutor(database);
    this.systems = new SystemCommandExecutor(database);
  }

  async create(
    actor: ActiveCultivatorRef,
    request: RedPacketRequest,
    scope: PacketScope,
  ) {
    const error = validateRedPacketInput(request);
    if (error) throw new ChatError(error);
    const fingerprint = chatRequestFingerprint({ ...scope, request });
    const committed = await this.players.executeWithLock({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'chat_red_packet_send',
      allowEmpty: true,
      command: async (tx) => {
        const [previous] = await tx
          .select()
          .from(chatRedPackets)
          .where(
            and(
              eq(chatRedPackets.senderUserId, actor.userId),
              eq(chatRedPackets.clientMessageId, request.clientMessageId),
            ),
          )
          .limit(1);
        if (previous) {
          if (previous.requestFingerprint !== fingerprint)
            throw new ChatError('同一发送标识不能用于不同红包', 409);
          if (!previous.messageSnapshot)
            throw new ChatError('红包正在确认，请稍后重试', 409);
          return {
            result: {
              message: {
                ...previous.messageSnapshot,
                payload: {
                  version: 1 as const,
                  packet: redPacketSummary(previous),
                },
              },
              outboxId: undefined,
            },
            resourceChanges: [],
          };
        }
        const identity = await requireActiveActor(actor, tx);
        await requirePacketAccess(actor, scope, tx);
        if (identity.spirit_stones < request.amount)
          throw new ChatError('灵石不足，红包未发出', 409);
        const amounts = allocateRedPacketAmounts(request, (min, max) =>
          randomInt(min, max + 1),
        );
        const cooldown = await (
          scope.channel === 'sect'
            ? checkAndAcquireSectChatCooldown
            : checkAndAcquireCooldown
        )(actor.cultivatorId, identity.realm);
        if (!cooldown.allowed)
          throw new ChatError(
            `请 ${cooldown.remainingSeconds} 秒后再发言`,
            429,
            cooldown.remainingSeconds,
          );
        const balance = await exactCurrency(tx, actor, -request.amount);
        const messageId = randomUUID();
        const [packet] = await tx
          .insert(chatRedPackets)
          .values({
            messageId,
            senderUserId: actor.userId,
            senderCultivatorId: actor.cultivatorId,
            clientMessageId: request.clientMessageId,
            requestFingerprint: fingerprint,
            ...scope,
            amount: request.amount,
            count: request.count,
            amounts,
            mode: request.mode,
            greeting:
              textFilter.mask(request.greeting).text || '仙途同庆，见者有份',
            remainingAmount: request.amount,
            remainingCount: request.count,
            expiresAt: new Date(Date.now() + 86_400_000),
          })
          .returning();
        const created = await insertChatMessage(
          {
            id: messageId,
            senderUserId: actor.userId,
            senderCultivatorId: actor.cultivatorId,
            senderName: identity.name,
            senderRealm: identity.realm,
            senderRealmStage: identity.realm_stage,
            ...scope,
            messageType: 'red_packet',
            textContent: packet!.greeting,
            payload: { version: 1, packet: redPacketSummary(packet!) },
            clientMessageId: request.clientMessageId,
            requestFingerprint: fingerprint,
          },
          tx,
        );
        await tx
          .update(chatRedPackets)
          .set({ messageSnapshot: created.message })
          .where(eq(chatRedPackets.id, packet!.id));
        return {
          result: created,
          resourceChanges: [currencyChange(actor.cultivatorId, balance)],
        };
      },
    });
    publishTransactionalMessageBestEffort(committed.result.outboxId, {
      context: 'red-packet-send',
    });
    return {
      ...toPlayerStateMutationResponse({
        ...committed,
        result: committed.result.message,
      }),
      cooldownSeconds: await getChatCooldownRemaining(
        actor.cultivatorId,
        scope.channel,
      ),
    };
  }

  async detail(
    actor: ActiveCultivatorRef,
    id: string,
  ): Promise<RedPacketDetails> {
    await this.expire(id);
    return this.database.transaction(async (tx) => {
      await requireActiveActor(actor, tx);
      const packet = await lockPacket(tx, id);
      if (packet.senderUserId !== actor.userId)
        await requirePacketAccess(actor, packet, tx);
      const claims = await tx
        .select()
        .from(chatRedPacketClaims)
        .where(eq(chatRedPacketClaims.packetId, id))
        .orderBy(desc(chatRedPacketClaims.claimedAt));
      const mine = claims.find((claim) => claim.claimerUserId === actor.userId);
      return {
        packet: redPacketSummary(packet),
        isSender: packet.senderUserId === actor.userId,
        myClaim: mine
          ? { amount: mine.amount, claimedAt: mine.claimedAt.toISOString() }
          : null,
        claims: claims.map((claim) => ({
          senderName: claim.senderName,
          amount: claim.amount,
          claimedAt: claim.claimedAt.toISOString(),
        })),
      };
    });
  }

  async claim(actor: ActiveCultivatorRef, id: string) {
    await this.expire(id);
    const committed = await this.players.executeWithLock<{
      packet: RedPacketSummary;
      claim: RedPacketClaimDTO;
      outboxId?: string;
    }>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'chat_red_packet_claim',
      allowEmpty: true,
      command: async (tx) => {
        const identity = await requireActiveActor(actor, tx);
        const packet = await lockPacket(tx, id);
        await requirePacketAccess(actor, packet, tx);
        const [previous] = await tx
          .select()
          .from(chatRedPacketClaims)
          .where(
            and(
              eq(chatRedPacketClaims.packetId, id),
              eq(chatRedPacketClaims.claimerUserId, actor.userId),
            ),
          )
          .limit(1);
        if (previous)
          return {
            result: {
              packet: redPacketSummary(packet),
              claim: {
                amount: previous.amount,
                claimedAt: previous.claimedAt.toISOString(),
              },
              outboxId: undefined,
            },
            resourceChanges: [],
          };
        if (packet.senderUserId === actor.userId)
          throw new ChatError('不能领取自己发出的红包');
        if (packet.status !== 'open' || packet.expiresAt <= new Date())
          throw new ChatError(
            packet.status === 'exhausted' ? '红包已领完' : '红包已过期',
            409,
          );
        const amount = packet.amounts[packet.count - packet.remainingCount]!;
        if (
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          amount > packet.remainingAmount
        )
          throw new Error('红包份额记录不一致');
        const balance = await exactCurrency(tx, actor, amount);
        const [claim] = await tx
          .insert(chatRedPacketClaims)
          .values({
            packetId: id,
            claimerUserId: actor.userId,
            cultivatorId: actor.cultivatorId,
            senderName: identity.name,
            amount,
          })
          .returning();
        const [updated] = await tx
          .update(chatRedPackets)
          .set({
            remainingAmount: packet.remainingAmount - amount,
            remainingCount: packet.remainingCount - 1,
            status: packet.remainingCount === 1 ? 'exhausted' : 'open',
            revision: packet.revision + 1,
          })
          .where(eq(chatRedPackets.id, id))
          .returning();
        const outbox = await queuePacketUpdate(tx, updated!);
        return {
          result: {
            packet: redPacketSummary(updated!),
            claim: { amount, claimedAt: claim!.claimedAt.toISOString() },
            outboxId: outbox.id,
          },
          resourceChanges: [currencyChange(actor.cultivatorId, balance)],
        };
      },
    });
    publishTransactionalMessageBestEffort(committed.result.outboxId, {
      context: 'red-packet-claim',
    });
    return toPlayerStateMutationResponse({
      ...committed,
      result: {
        packet: committed.result.packet,
        claim: committed.result.claim,
      },
    });
  }

  async expire(id: string) {
    const [candidate] = await this.database
      .select()
      .from(chatRedPackets)
      .where(eq(chatRedPackets.id, id))
      .limit(1);
    if (
      !candidate ||
      (candidate.status !== 'open' && candidate.refundStatus !== 'pending') ||
      candidate.expiresAt > new Date()
    )
      return;
    const committed = await this.systems.execute({
      source: 'chat_red_packet_expire',
      allowEmpty: true,
      command: async (tx) => {
        // All paths lock a character before the packet. Deleted characters have no row to lock.
        const [sender] = await tx
          .select({ id: cultivators.id })
          .from(cultivators)
          .where(eq(cultivators.id, candidate.senderCultivatorId))
          .limit(1);
        if (sender) await lockCultivatorForStateMutation(tx, sender.id);
        let packet = await lockPacket(tx, id);
        if (
          packet.expiresAt > new Date() ||
          (packet.status !== 'open' && packet.refundStatus !== 'pending')
        )
          return { result: { outboxId: undefined }, resourceChanges: [] };
        let changed = false;
        const changes: ResourceChangeDescriptor[] = [];
        if (packet.status === 'open') {
          const [closed] = await tx
            .update(chatRedPackets)
            .set({
              status: 'expired',
              remainingAmount: 0,
              remainingCount: 0,
              refundAmount: packet.remainingAmount,
              refundStatus: packet.remainingAmount > 0 ? 'pending' : 'none',
              revision: packet.revision + 1,
            })
            .where(eq(chatRedPackets.id, id))
            .returning();
          packet = closed!;
          changed = true;
        }
        if (packet.refundStatus === 'pending' && sender) {
          const [active] = await tx
            .select({ id: cultivators.id, balance: cultivators.spirit_stones })
            .from(cultivators)
            .where(
              and(
                eq(cultivators.userId, packet.senderUserId),
                eq(cultivators.status, 'active'),
              ),
            )
            .limit(1);
          if (
            active?.id === packet.senderCultivatorId &&
            active.balance + packet.refundAmount <= BALANCE_CEILING
          ) {
            const balance = await exactCurrency(
              tx,
              { userId: packet.senderUserId, cultivatorId: active.id },
              packet.refundAmount,
            );
            changes.push(currencyChange(active.id, balance));
            const [refunded] = await tx
              .update(chatRedPackets)
              .set({
                refundStatus: 'refunded',
                refundCultivatorId: active.id,
                refundedAt: new Date(),
                revision: packet.revision + 1,
              })
              .where(eq(chatRedPackets.id, id))
              .returning();
            packet = refunded!;
            changed = true;
          }
        }
        const outbox = changed
          ? await queuePacketUpdate(tx, packet)
          : undefined;
        return { result: { outboxId: outbox?.id }, resourceChanges: changes };
      },
    });
    publishTransactionalMessageBestEffort(committed.result.outboxId, {
      context: 'red-packet-expire',
    });
  }

  async listRefunds(actor: ActiveCultivatorRef) {
    const due = await this.database
      .select({ id: chatRedPackets.id })
      .from(chatRedPackets)
      .where(
        and(
          eq(chatRedPackets.senderUserId, actor.userId),
          eq(chatRedPackets.status, 'open'),
          lte(chatRedPackets.expiresAt, new Date()),
        ),
      )
      .limit(100);
    for (const packet of due) await this.expire(packet.id);
    const pending = await this.database
      .select()
      .from(chatRedPackets)
      .where(
        and(
          eq(chatRedPackets.senderUserId, actor.userId),
          eq(chatRedPackets.refundStatus, 'pending'),
        ),
      )
      .orderBy(desc(chatRedPackets.expiresAt));
    return pending.map(redPacketSummary);
  }

  async claimRefund(actor: ActiveCultivatorRef, id: string) {
    await this.expire(id);
    const committed = await this.players.executeWithLock<{
      packet: RedPacketSummary;
      amount: number;
      outboxId?: string;
    }>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'chat_red_packet_refund',
      allowEmpty: true,
      command: async (tx) => {
        await requireActiveActor(actor, tx);
        const packet = await lockPacket(tx, id);
        if (packet.senderUserId !== actor.userId)
          throw new ChatError('无权领取该退款', 403);
        if (packet.refundStatus === 'refunded')
          return {
            result: {
              packet: redPacketSummary(packet),
              amount: packet.refundAmount,
              outboxId: undefined,
            },
            resourceChanges: [],
          };
        if (packet.refundStatus !== 'pending')
          throw new ChatError('暂无可领取退款', 409);
        const balance = await exactCurrency(tx, actor, packet.refundAmount);
        const [updated] = await tx
          .update(chatRedPackets)
          .set({
            refundStatus: 'refunded',
            refundCultivatorId: actor.cultivatorId,
            refundedAt: new Date(),
            revision: packet.revision + 1,
          })
          .where(eq(chatRedPackets.id, id))
          .returning();
        const outbox = await queuePacketUpdate(tx, updated!);
        return {
          result: {
            packet: redPacketSummary(updated!),
            amount: packet.refundAmount,
            outboxId: outbox.id,
          },
          resourceChanges: [currencyChange(actor.cultivatorId, balance)],
        };
      },
    });
    publishTransactionalMessageBestEffort(committed.result.outboxId, {
      context: 'red-packet-refund',
    });
    return toPlayerStateMutationResponse({
      ...committed,
      result: {
        packet: committed.result.packet,
        amount: committed.result.amount,
      },
    });
  }

  async expireDue() {
    const packets = await this.database
      .select({ id: chatRedPackets.id })
      .from(chatRedPackets)
      .where(
        and(
          lte(chatRedPackets.expiresAt, new Date()),
          eq(chatRedPackets.status, 'open'),
        ),
      )
      .orderBy(chatRedPackets.expiresAt)
      .limit(100);
    for (const packet of packets) await this.expire(packet.id);
    // Full/deleted/retired wallets keep their account refund rights without occupying this batch.
    const retryable = await this.database.select({ id: chatRedPackets.id }).from(chatRedPackets)
      .innerJoin(cultivators, and(eq(cultivators.id, chatRedPackets.senderCultivatorId), eq(cultivators.userId, chatRedPackets.senderUserId), eq(cultivators.status, 'active')))
      .where(and(eq(chatRedPackets.refundStatus, 'pending'), sql`${cultivators.spirit_stones} + ${chatRedPackets.refundAmount} <= ${BALANCE_CEILING}`))
      .orderBy(chatRedPackets.expiresAt).limit(100);
    for (const packet of retryable) await this.expire(packet.id);
    return packets.length + retryable.length;
  }
}

export const redPacketService = new RedPacketService();
