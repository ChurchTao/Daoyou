import { sendViaSmtp } from '@server/lib/admin/smtp';
import { getAdminUserIds } from '@server/lib/auth/adminAccess';
import { authUsers } from '@server/lib/auth/schema';
import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  sponsorshipAdminActions,
  sponsorshipCheckoutIntents,
  sponsorshipClaims,
  sponsorshipMeritProfiles,
  sponsorshipMeritRecords,
  sponsorshipOrders,
  sponsorshipOrderSnapshots,
} from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import {
  isRedisLockContention,
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock';
import {
  getAfdianSponsorshipConfig,
  upsertAfdianSponsorshipConfig,
} from '@server/lib/repositories/appSettingsRepository';
import { hashSponsorshipClaimCode } from '@server/lib/sponsorship/claimCode';
import { requireSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry';
import type { ProviderOrder } from '@server/lib/sponsorship/types';
import {
  formatSponsorshipMonth,
  highestSponsorshipTier,
  isSponsorshipOrderAccepted,
  resolveSponsorshipTier,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  sql,
} from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { MailService } from './MailService';

const SNAPSHOT_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1_000;
const CLAIM_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
const CHECKOUT_INTENT_MS = 24 * 60 * 60 * 1_000;
const UuidSchema = z.uuid();

export class SponsorshipApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(message);
    this.name = 'SponsorshipApplicationError';
  }
}

function isAutomaticFulfillmentEnabled(): boolean {
  return process.env.SPONSORSHIP_FULFILLMENT_ENABLED === 'true';
}

function snapshotExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SNAPSHOT_RETENTION_MS);
}

function orderValues(order: ProviderOrder) {
  return {
    customOrderId: order.customOrderId,
    providerUserId: order.providerUserId,
    planId: order.planId,
    skuId: order.skuId,
    productType: order.productType,
    totalAmountFen: order.totalAmountFen,
    showAmountFen: order.showAmountFen,
    month: order.month,
    providerStatus: order.status,
    providerCreatedAt: order.createdAt,
    updatedAt: new Date(),
  };
}

async function insertSnapshot(
  tx: DbTransaction,
  orderId: string,
  source: string,
  payload: unknown,
): Promise<void> {
  await tx.insert(sponsorshipOrderSnapshots).values({
    orderId,
    source,
    payload,
    purgeAfter: snapshotExpiry(),
  });
}

export async function recordAfdianWebhook(
  payload: unknown,
): Promise<{ orderId: string; duplicate: boolean }> {
  const provider = requireSponsorshipProvider();
  if (provider.id !== 'afdian') throw new Error('Webhook Provider 不匹配');
  const verified = provider.verifyWebhook(payload);

  const committed = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(sponsorshipOrders)
      .values({
        provider: provider.id,
        providerOrderId: verified.order.providerOrderId,
        ...orderValues(verified.order),
        verificationStatus: 'signature_verified',
        signatureVerifiedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: sponsorshipOrders.id });

    let orderId = inserted?.id;
    let existingOrder:
      | Pick<
          typeof sponsorshipOrders.$inferSelect,
          | 'id'
          | 'providerOrderId'
          | 'providerUserId'
          | 'planId'
          | 'totalAmountFen'
          | 'signatureVerifiedAt'
          | 'verificationStatus'
        >
      | undefined;
    if (!orderId) {
      existingOrder = await tx.query.sponsorshipOrders.findFirst({
        columns: {
          id: true,
          providerOrderId: true,
          providerUserId: true,
          planId: true,
          totalAmountFen: true,
          signatureVerifiedAt: true,
          verificationStatus: true,
        },
        where: and(
          eq(sponsorshipOrders.provider, provider.id),
          eq(sponsorshipOrders.providerOrderId, verified.order.providerOrderId),
        ),
      });
      if (!existingOrder) throw new Error('重复 Webhook 对应订单不存在');
      orderId = existingOrder.id;
    }

    if (inserted || !existingOrder?.signatureVerifiedAt) {
      if (
        existingOrder &&
        (existingOrder.providerOrderId !== verified.order.providerOrderId ||
          existingOrder.providerUserId !== verified.order.providerUserId ||
          existingOrder.planId !== verified.order.planId ||
          existingOrder.totalAmountFen !== verified.order.totalAmountFen)
      ) {
        throw new Error('Webhook 与已落库订单核心字段不一致');
      }
      await insertSnapshot(tx, orderId, 'webhook', verified.raw);
      if (existingOrder) {
        await tx
          .update(sponsorshipOrders)
          .set({
            signatureVerifiedAt: new Date(),
            verificationStatus:
              existingOrder.verificationStatus === 'verified'
                ? 'verified'
                : 'signature_verified',
            updatedAt: new Date(),
          })
          .where(eq(sponsorshipOrders.id, orderId));
      }
    }
    let domainEventId: string | undefined;
    if (inserted) {
      domainEventId = (
        await createDomainEvent(
          {
            type: 'sponsorship.order.received',
            aggregate: { type: 'sponsorship_order', id: orderId },
            data: {
              orderId,
              provider: 'afdian',
              providerOrderId: verified.order.providerOrderId,
            },
            deduplicationKey: `afdian:${verified.order.providerOrderId}`,
          },
          tx,
        )
      ).id;
    }
    return { orderId, duplicate: !inserted, domainEventId };
  });

  publishTransactionalMessageBestEffort(committed.domainEventId, {
    source: 'sponsorship_webhook',
    orderId: committed.orderId,
  });
  return { orderId: committed.orderId, duplicate: committed.duplicate };
}

export async function recordReconciledOrder(
  providerOrder: ProviderOrder,
): Promise<{ orderId: string; inserted: boolean }> {
  const committed = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(sponsorshipOrders)
      .values({
        provider: providerOrder.provider,
        providerOrderId: providerOrder.providerOrderId,
        ...orderValues(providerOrder),
        verificationStatus: 'received',
      })
      .onConflictDoNothing()
      .returning({ id: sponsorshipOrders.id });
    const existing = inserted
      ? null
      : await tx.query.sponsorshipOrders.findFirst({
          columns: { id: true },
          where: and(
            eq(sponsorshipOrders.provider, providerOrder.provider),
            eq(
              sponsorshipOrders.providerOrderId,
              providerOrder.providerOrderId,
            ),
          ),
        });
    const orderId = inserted?.id ?? existing?.id;
    if (!orderId) throw new Error('对账订单落库失败');
    if (inserted) {
      await insertSnapshot(tx, orderId, 'reconcile', providerOrder.raw);
    }

    let domainEventId: string | undefined;
    if (inserted) {
      domainEventId = (
        await createDomainEvent(
          {
            type: 'sponsorship.order.received',
            aggregate: { type: 'sponsorship_order', id: orderId },
            data: {
              orderId,
              provider: 'afdian',
              providerOrderId: providerOrder.providerOrderId,
            },
            deduplicationKey: `afdian:${providerOrder.providerOrderId}`,
          },
          tx,
        )
      ).id;
    }
    return { orderId, inserted: Boolean(inserted), domainEventId };
  });
  publishTransactionalMessageBestEffort(committed.domainEventId, {
    source: 'sponsorship_reconcile',
    orderId: committed.orderId,
  });
  return { orderId: committed.orderId, inserted: committed.inserted };
}

function assertApiMatchesSignedOrder(
  existing: typeof sponsorshipOrders.$inferSelect,
  queried: ProviderOrder,
): void {
  if (!existing.signatureVerifiedAt || existing.sensitivePurgedAt) return;
  if (
    existing.providerOrderId !== queried.providerOrderId ||
    existing.providerUserId !== queried.providerUserId ||
    existing.planId !== queried.planId ||
    existing.totalAmountFen !== queried.totalAmountFen
  ) {
    throw new Error('API 订单与已签名 Webhook 核心字段不一致');
  }
}

async function matchCheckoutIntent(
  tx: DbTransaction,
  order: ProviderOrder,
  tier: SponsorshipTierId,
) {
  if (
    !order.customOrderId ||
    !UuidSchema.safeParse(order.customOrderId).success
  ) {
    return { kind: 'offsite' as const, intent: null };
  }
  const intent = await tx.query.sponsorshipCheckoutIntents.findFirst({
    where: eq(sponsorshipCheckoutIntents.id, order.customOrderId),
  });
  if (!intent) return { kind: 'offsite' as const, intent: null };
  if (
    intent.status !== 'pending' ||
    intent.expiresAt < (order.createdAt ?? new Date()) ||
    (order.createdAt !== null &&
      order.createdAt.getTime() < intent.createdAt.getTime() - 5 * 60_000) ||
    !intent.userId ||
    !intent.cultivatorId ||
    intent.tier !== tier ||
    (intent.expectedPlanId && intent.expectedPlanId !== order.planId)
  ) {
    return { kind: 'invalid_intent' as const, intent };
  }
  const cultivator = await tx.query.cultivators.findFirst({
    columns: { id: true, userId: true },
    where: and(
      eq(cultivators.id, intent.cultivatorId),
      eq(cultivators.userId, intent.userId),
    ),
  });
  return cultivator
    ? { kind: 'matched' as const, intent }
    : { kind: 'invalid_intent' as const, intent };
}

export async function processSponsorshipOrder(orderId: string): Promise<void> {
  try {
    await withRedisLock(
      {
        key: redisLockKeys.sponsorshipOrder(orderId),
        context: 'sponsorship-order-process',
        timeoutMs: 90_000,
        retries: 2,
        delayMs: 100,
      },
      async (lease) => {
        const existing = await db.query.sponsorshipOrders.findFirst({
          where: eq(sponsorshipOrders.id, orderId),
        });
        if (
          !existing ||
          existing.fulfillmentStatus === 'fulfilled' ||
          existing.fulfillmentStatus === 'revoked'
        )
          return;
        const config = await getAfdianSponsorshipConfig();
        if (
          existing.verificationStatus === 'verified' &&
          !isSponsorshipOrderAccepted(existing.providerCreatedAt, config)
        ) {
          await db
            .update(sponsorshipOrders)
            .set({
              fulfillmentStatus: 'needs_attention',
              lastErrorCode: 'PRE_ACTIVATION_ORDER',
              lastErrorMessage:
                '订单早于功德簿自动处理起始时间，仅可由管理员手动发放',
              updatedAt: new Date(),
            })
            .where(eq(sponsorshipOrders.id, orderId));
          return;
        }
        if (
          existing.verificationStatus === 'verified' &&
          !isAutomaticFulfillmentEnabled()
        )
          return;
        if (
          isAutomaticFulfillmentEnabled() &&
          existing.verificationStatus === 'verified' &&
          existing.resolvedTier
        ) {
          if (existing.checkoutIntentId) {
            const intent = await db.query.sponsorshipCheckoutIntents.findFirst({
              where: eq(
                sponsorshipCheckoutIntents.id,
                existing.checkoutIntentId,
              ),
            });
            if (intent?.cultivatorId) {
              await fulfillOrderToCultivator(
                orderId,
                intent.cultivatorId,
                'order',
                intent.publicListing,
              );
              return;
            }
          }
          const claimed = await db.query.sponsorshipClaims.findFirst({
            where: and(
              eq(sponsorshipClaims.orderId, orderId),
              eq(sponsorshipClaims.status, 'claimed'),
            ),
          });
          if (claimed?.cultivatorId) {
            await fulfillOrderToCultivator(
              orderId,
              claimed.cultivatorId,
              'claim',
              claimed.publicListing,
            );
            return;
          }
          if (existing.fulfillmentStatus === 'awaiting_claim') {
            await ensureClaimAndSendMessage(orderId);
            return;
          }
        }
        const provider = requireSponsorshipProvider();

        await db
          .update(sponsorshipOrders)
          .set({ verificationStatus: 'api_verifying', updatedAt: new Date() })
          .where(eq(sponsorshipOrders.id, orderId));

        const queried = await provider.queryOrder(existing.providerOrderId);
        if (!queried || queried.status !== 2) {
          await db
            .update(sponsorshipOrders)
            .set({
              verificationStatus: 'needs_attention',
              fulfillmentStatus: 'pending',
              lastErrorCode: 'ORDER_NOT_SUCCESSFUL',
              lastErrorMessage: 'API 未返回成功订单',
              updatedAt: new Date(),
            })
            .where(eq(sponsorshipOrders.id, orderId));
          return;
        }
        assertApiMatchesSignedOrder(existing, queried);
        if (!isSponsorshipOrderAccepted(queried.createdAt, config)) {
          await db
            .update(sponsorshipOrders)
            .set({
              ...orderValues(queried),
              verificationStatus: 'verified',
              fulfillmentStatus: 'needs_attention',
              configSnapshot: config,
              verifiedAt: new Date(),
              lastErrorCode: 'PRE_ACTIVATION_ORDER',
              lastErrorMessage:
                '订单早于功德簿自动处理起始时间，仅可由管理员手动发放',
            })
            .where(eq(sponsorshipOrders.id, orderId));
          return;
        }
        const tier = resolveSponsorshipTier(
          { planId: queried.planId, totalAmountFen: queried.totalAmountFen },
          config,
        );
        if (!tier) {
          await db
            .update(sponsorshipOrders)
            .set({
              ...orderValues(queried),
              verificationStatus: 'needs_attention',
              fulfillmentStatus: 'needs_attention',
              lastErrorCode: 'UNMAPPED_ORDER',
              lastErrorMessage: '订单未命中启用的功德档位',
            })
            .where(eq(sponsorshipOrders.id, orderId));
          return;
        }

        const match = await db.transaction(async (tx) => {
          await insertSnapshot(tx, orderId, 'query_order', queried.raw);
          const intentMatch = await matchCheckoutIntent(tx, queried, tier);
          const intent =
            intentMatch.kind === 'matched' ? intentMatch.intent : null;
          const invalidIntent = intentMatch.kind === 'invalid_intent';
          await tx
            .update(sponsorshipOrders)
            .set({
              ...orderValues(queried),
              verificationStatus: 'verified',
              fulfillmentStatus: invalidIntent
                ? 'needs_attention'
                : intent
                  ? 'linked'
                  : 'awaiting_claim',
              resolvedTier: tier,
              checkoutIntentId: intent?.id ?? null,
              configSnapshot: config,
              verifiedAt: new Date(),
              lastErrorCode: invalidIntent ? 'INVALID_CHECKOUT_INTENT' : null,
              lastErrorMessage: invalidIntent
                ? '游戏下单意图已失效、档位不符或原角色已不存在'
                : null,
            })
            .where(eq(sponsorshipOrders.id, orderId));
          if (intent) {
            await tx
              .update(sponsorshipCheckoutIntents)
              .set({
                status: 'matched',
                providerOrderId: queried.providerOrderId,
                updatedAt: new Date(),
              })
              .where(eq(sponsorshipCheckoutIntents.id, intent.id));
          }
          return { intent, invalidIntent };
        });
        lease.assertHeld();
        if (!isAutomaticFulfillmentEnabled()) return;
        if (match.invalidIntent) return;
        if (match.intent?.cultivatorId) {
          await fulfillOrderToCultivator(
            orderId,
            match.intent.cultivatorId,
            'order',
            match.intent.publicListing,
          );
        } else {
          await ensureClaimAndSendMessage(orderId);
        }
      },
    );
  } catch (error) {
    if (isRedisLockContention(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const verificationMismatch = message.includes(
      'API 订单与已签名 Webhook 核心字段不一致',
    );
    await db
      .update(sponsorshipOrders)
      .set({
        verificationStatus: verificationMismatch
          ? 'needs_attention'
          : undefined,
        fulfillmentStatus: verificationMismatch
          ? 'needs_attention'
          : 'retry_wait',
        retryCount: sql`${sponsorshipOrders.retryCount} + 1`,
        lastErrorCode: verificationMismatch
          ? 'SIGNED_ORDER_MISMATCH'
          : 'PROCESSING_FAILED',
        lastErrorMessage: message.slice(0, 1_000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sponsorshipOrders.id, orderId),
          sql`${sponsorshipOrders.fulfillmentStatus} NOT IN ('fulfilled', 'revoked')`,
        ),
      );
    throw error;
  }
}

function buildMeritMail(args: {
  tier: SponsorshipTierId;
  cultivatorName: string;
  kind: 'first' | 'repeat' | 'upgrade';
  supportedAt: Date;
}): { title: string; content: string } {
  const tierName = SPONSORSHIP_TIER_META[args.tier].name;
  const opening =
    args.kind === 'first'
      ? '此念初照功德簿，山河因道友多了一点微光。'
      : args.kind === 'upgrade'
        ? '旧功未泯，新愿又添，功德簿上的印记更进一步。'
        : '旧缘未断，道友再度为此间添上一笔温暖。';
  const month = formatSponsorshipMonth(args.supportedAt);
  return {
    title: `【功德簿】${tierName}`,
    content: [
      `${args.cultivatorName}道友：`,
      '',
      opening,
      `本次功德已按「${tierName}」于 ${month} 留存。`,
      '此信不含数值奖励，唯记同行之谊。',
    ].join('\n'),
  };
}

async function fulfillOrderToCultivator(
  orderId: string,
  cultivatorId: string,
  source: 'order' | 'claim',
  publicListing = true,
): Promise<void> {
  await withRedisLock(
    {
      key: redisLockKeys.sponsorshipCultivator(cultivatorId),
      context: 'sponsorship-cultivator-fulfillment',
      timeoutMs: 60_000,
      retries: 2,
      delayMs: 100,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const order = await tx.query.sponsorshipOrders.findFirst({
          where: eq(sponsorshipOrders.id, orderId),
        });
        if (!order?.resolvedTier || order.fulfillmentStatus === 'fulfilled')
          return;
        if (order.fulfillmentStatus === 'revoked') {
          throw new SponsorshipApplicationError(
            '已撤销订单不能再履约',
            'SPONSORSHIP_ORDER_REVOKED',
            409,
          );
        }
        const existingRecord = await tx.query.sponsorshipMeritRecords.findFirst(
          {
            columns: { id: true },
            where: eq(sponsorshipMeritRecords.orderId, orderId),
          },
        );
        if (existingRecord) {
          await tx
            .update(sponsorshipOrders)
            .set({ fulfillmentStatus: 'fulfilled', fulfilledAt: new Date() })
            .where(eq(sponsorshipOrders.id, orderId));
          return;
        }
        const cultivator = await tx.query.cultivators.findFirst({
          columns: { id: true, name: true },
          where: eq(cultivators.id, cultivatorId),
        });
        if (!cultivator) throw new Error('功德目标角色不存在');
        const profile = await tx.query.sponsorshipMeritProfiles.findFirst({
          where: eq(sponsorshipMeritProfiles.cultivatorId, cultivatorId),
        });
        const previousHighest = profile?.highestTier ?? null;
        const nextHighest = highestSponsorshipTier(
          previousHighest
            ? [previousHighest, order.resolvedTier]
            : [order.resolvedTier],
        )!;
        const kind = !profile
          ? 'first'
          : nextHighest !== previousHighest
            ? 'upgrade'
            : 'repeat';
        const supportedAt = order.providerCreatedAt ?? order.createdAt;
        const mailCopy = buildMeritMail({
          tier: order.resolvedTier,
          cultivatorName: cultivator.name,
          kind,
          supportedAt,
        });
        const mail = await MailService.sendSystemMail(
          cultivatorId,
          mailCopy.title,
          mailCopy.content,
          tx,
        );
        await tx.insert(sponsorshipMeritRecords).values({
          orderId,
          cultivatorId,
          tier: order.resolvedTier,
          source,
          supportedAt,
          mailId: mail.id,
        });
        await tx
          .insert(sponsorshipMeritProfiles)
          .values({
            cultivatorId,
            isPublic: publicListing,
            highestTier: nextHighest,
            meritCount: 1,
            firstSupportedAt: supportedAt,
            lastSupportedAt: supportedAt,
          })
          .onConflictDoUpdate({
            target: sponsorshipMeritProfiles.cultivatorId,
            set: {
              isPublic: publicListing,
              highestTier: nextHighest,
              meritCount: sql`${sponsorshipMeritProfiles.meritCount} + 1`,
              firstSupportedAt: sql`LEAST(${sponsorshipMeritProfiles.firstSupportedAt}, ${supportedAt})`,
              lastSupportedAt: sql`GREATEST(${sponsorshipMeritProfiles.lastSupportedAt}, ${supportedAt})`,
              updatedAt: new Date(),
            },
          });
        await tx
          .update(sponsorshipOrders)
          .set({
            fulfillmentStatus: 'fulfilled',
            fulfilledAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(sponsorshipOrders.id, orderId));
        if (order.checkoutIntentId) {
          await tx
            .update(sponsorshipCheckoutIntents)
            .set({ status: 'fulfilled', updatedAt: new Date() })
            .where(eq(sponsorshipCheckoutIntents.id, order.checkoutIntentId));
        }
        lease.assertHeld();
      }),
  );
}

function newClaimCode(): string {
  return `GD${randomBytes(10).toString('hex').toUpperCase()}`;
}

async function ensureClaimAndSendMessage(orderId: string): Promise<void> {
  const provider = requireSponsorshipProvider();
  const order = await db.query.sponsorshipOrders.findFirst({
    where: eq(sponsorshipOrders.id, orderId),
  });
  if (!order?.providerUserId || !order.resolvedTier) {
    throw new Error('待认领订单缺少用户或档位');
  }
  let claim = await db.query.sponsorshipClaims.findFirst({
    where: eq(sponsorshipClaims.orderId, orderId),
  });
  if (!claim) {
    const code = newClaimCode();
    const [created] = await db
      .insert(sponsorshipClaims)
      .values({
        orderId,
        codeHash: hashSponsorshipClaimCode(code),
        code,
        expiresAt: new Date(Date.now() + CLAIM_RETENTION_MS),
      })
      .onConflictDoNothing()
      .returning();
    claim =
      created ??
      (await db.query.sponsorshipClaims.findFirst({
        where: eq(sponsorshipClaims.orderId, orderId),
      }));
  }
  if (claim?.status === 'active' && claim.expiresAt < new Date()) {
    await db.transaction(async (tx) => {
      await tx
        .update(sponsorshipClaims)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(sponsorshipClaims.id, claim!.id));
      await tx
        .update(sponsorshipOrders)
        .set({
          fulfillmentStatus: 'needs_attention',
          lastErrorCode: 'CLAIM_EXPIRED',
          lastErrorMessage: '站外订单认领码已过期，需管理员核查后轮换',
          updatedAt: new Date(),
        })
        .where(eq(sponsorshipOrders.id, orderId));
    });
    return;
  }
  if (!claim || claim.status !== 'active' || claim.messageStatus === 'sent')
    return;
  const tierName = SPONSORSHIP_TIER_META[order.resolvedTier].name;
  try {
    await provider.sendMessage(
      order.providerUserId,
      `感谢支持《万界道友》。本次「${tierName}」功德认领码：${claim.code}。请在游戏“功德簿”中于90天内认领。`,
    );
    await db
      .update(sponsorshipClaims)
      .set({
        messageStatus: 'sent',
        messageAttempts: sql`${sponsorshipClaims.messageAttempts} + 1`,
        lastMessageError: null,
        updatedAt: new Date(),
      })
      .where(eq(sponsorshipClaims.id, claim.id));
  } catch (error) {
    await db
      .update(sponsorshipClaims)
      .set({
        messageStatus: 'retry_wait',
        messageAttempts: sql`${sponsorshipClaims.messageAttempts} + 1`,
        lastMessageError: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 1_000),
        updatedAt: new Date(),
      })
      .where(eq(sponsorshipClaims.id, claim.id));
    throw error;
  }
}

export async function createSponsorshipCheckoutIntent(args: {
  userId: string;
  cultivatorId: string;
  tier: SponsorshipTierId;
  publicListing: boolean;
  customAmountFen?: number;
}): Promise<{ id: string; checkoutUrl: string; expiresAt: Date }> {
  const provider = requireSponsorshipProvider();
  const config = await getAfdianSponsorshipConfig();
  if (!config.acceptingCheckout || !isAutomaticFulfillmentEnabled()) {
    throw new SponsorshipApplicationError(
      '功德入口暂未开放',
      'SPONSORSHIP_CHECKOUT_CLOSED',
      503,
    );
  }
  const tierConfig = config.tiers[args.tier];
  const planId = args.customAmountFen ? null : tierConfig.planId || null;
  if (!planId && !args.customAmountFen) {
    throw new SponsorshipApplicationError(
      '该功德档位尚未配置方案',
      'SPONSORSHIP_TIER_UNCONFIGURED',
    );
  }
  if (
    args.customAmountFen &&
    (!config.acceptingCustomAmount ||
      resolveSponsorshipTier(
        { totalAmountFen: args.customAmountFen },
        config,
      ) !== args.tier)
  ) {
    throw new SponsorshipApplicationError(
      '自选金额与所选功德档位不匹配',
      'SPONSORSHIP_AMOUNT_TIER_MISMATCH',
    );
  }
  const expiresAt = new Date(Date.now() + CHECKOUT_INTENT_MS);
  const [intent] = await db
    .insert(sponsorshipCheckoutIntents)
    .values({
      provider: provider.id,
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      tier: args.tier,
      expectedPlanId: planId,
      publicListing: args.publicListing,
      configSnapshot: config,
      expiresAt,
    })
    .returning({ id: sponsorshipCheckoutIntents.id });
  if (!intent) throw new Error('创建功德下单意图失败');
  const checkoutUrl = provider.buildCheckoutUrl({
    intentId: intent.id,
    tier: args.tier,
    planId,
    customAmountFen: args.customAmountFen,
  });
  return { id: intent.id, checkoutUrl: checkoutUrl.toString(), expiresAt };
}

export async function claimSponsorshipOrder(args: {
  userId: string;
  cultivatorId: string;
  code: string;
  publicListing: boolean;
}): Promise<void> {
  const codeHash = hashSponsorshipClaimCode(args.code);
  const claim = await db.query.sponsorshipClaims.findFirst({
    where: eq(sponsorshipClaims.codeHash, codeHash),
  });
  if (!claim || claim.status !== 'active' || claim.expiresAt < new Date()) {
    throw new SponsorshipApplicationError(
      '功德认领码不存在或已失效',
      'SPONSORSHIP_CLAIM_INVALID',
    );
  }
  await withRedisLock(
    {
      key: redisLockKeys.sponsorshipOrder(claim.orderId),
      context: 'sponsorship-claim',
      timeoutMs: 60_000,
      retries: 1,
    },
    async (orderLease) => {
      const now = new Date();
      const cultivator = await db.query.cultivators.findFirst({
        columns: { id: true },
        where: and(
          eq(cultivators.id, args.cultivatorId),
          eq(cultivators.userId, args.userId),
        ),
      });
      if (!cultivator) {
        throw new SponsorshipApplicationError(
          '目标角色不存在',
          'SPONSORSHIP_CULTIVATOR_NOT_FOUND',
          404,
        );
      }
      await db.transaction(async (tx) => {
        const currentOrder = await tx.query.sponsorshipOrders.findFirst({
          columns: {
            id: true,
            verificationStatus: true,
            fulfillmentStatus: true,
            resolvedTier: true,
          },
          where: eq(sponsorshipOrders.id, claim.orderId),
        });
        if (
          !currentOrder ||
          currentOrder.verificationStatus !== 'verified' ||
          !currentOrder.resolvedTier ||
          !['awaiting_claim', 'retry_wait'].includes(
            currentOrder.fulfillmentStatus,
          )
        ) {
          throw new SponsorshipApplicationError(
            '该订单当前不可认领',
            'SPONSORSHIP_CLAIM_ORDER_UNAVAILABLE',
            409,
          );
        }
        const [updated] = await tx
          .update(sponsorshipClaims)
          .set({
            status: 'claimed',
            cultivatorId: args.cultivatorId,
            claimedAt: new Date(),
            publicListing: args.publicListing,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(sponsorshipClaims.id, claim.id),
              eq(sponsorshipClaims.codeHash, codeHash),
              eq(sponsorshipClaims.status, 'active'),
              gt(sponsorshipClaims.expiresAt, now),
            ),
          )
          .returning({ id: sponsorshipClaims.id });
        if (!updated) {
          throw new SponsorshipApplicationError(
            '功德认领码已被使用',
            'SPONSORSHIP_CLAIM_USED',
            409,
          );
        }
        const [linkedOrder] = await tx
          .update(sponsorshipOrders)
          .set({ fulfillmentStatus: 'linked', updatedAt: new Date() })
          .where(
            and(
              eq(sponsorshipOrders.id, claim.orderId),
              inArray(sponsorshipOrders.fulfillmentStatus, [
                'awaiting_claim',
                'retry_wait',
              ]),
            ),
          )
          .returning({ id: sponsorshipOrders.id });
        if (!linkedOrder) {
          throw new SponsorshipApplicationError(
            '该订单当前不可认领',
            'SPONSORSHIP_CLAIM_ORDER_UNAVAILABLE',
            409,
          );
        }
        orderLease.assertHeld();
      });
      await fulfillOrderToCultivator(
        claim.orderId,
        args.cultivatorId,
        'claim',
        args.publicListing,
      );
    },
  );
}

export async function cleanupSponsorshipSensitiveData(
  now = new Date(),
): Promise<{
  snapshots: number;
  orders: number;
  claims: number;
  checkoutIntents: number;
}> {
  const [snapshots, orders, claims, checkoutIntents] = await db.transaction(
    async (tx) => {
      const removedSnapshots = await tx
        .delete(sponsorshipOrderSnapshots)
        .where(lt(sponsorshipOrderSnapshots.purgeAfter, now))
        .returning({ id: sponsorshipOrderSnapshots.id });
      const purgedOrders = await tx
        .update(sponsorshipOrders)
        .set({
          providerUserId: null,
          totalAmountFen: null,
          showAmountFen: null,
          sensitivePurgedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            isNull(sponsorshipOrders.sensitivePurgedAt),
            lt(
              sponsorshipOrders.createdAt,
              new Date(now.getTime() - SNAPSHOT_RETENTION_MS),
            ),
          ),
        )
        .returning({ id: sponsorshipOrders.id });
      const expiredClaims = await tx
        .update(sponsorshipClaims)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(sponsorshipClaims.status, 'active'),
            lt(sponsorshipClaims.expiresAt, now),
          ),
        )
        .returning({
          id: sponsorshipClaims.id,
          orderId: sponsorshipClaims.orderId,
        });
      if (expiredClaims.length > 0) {
        await tx
          .update(sponsorshipOrders)
          .set({
            fulfillmentStatus: 'needs_attention',
            lastErrorCode: 'CLAIM_EXPIRED',
            lastErrorMessage: '站外订单认领码已过期，需管理员核查后轮换',
            updatedAt: now,
          })
          .where(
            inArray(
              sponsorshipOrders.id,
              expiredClaims.map((claim) => claim.orderId),
            ),
          );
      }
      const purgedClaims = await tx
        .delete(sponsorshipClaims)
        .where(
          and(
            sql`${sponsorshipClaims.status} IN ('expired', 'claimed')`,
            lt(
              sponsorshipClaims.createdAt,
              new Date(now.getTime() - SNAPSHOT_RETENTION_MS),
            ),
          ),
        )
        .returning({ id: sponsorshipClaims.id });
      const expiredCheckoutIntents = await tx
        .update(sponsorshipCheckoutIntents)
        .set({
          status: sql`CASE WHEN ${sponsorshipCheckoutIntents.status} = 'pending' THEN 'expired' ELSE ${sponsorshipCheckoutIntents.status} END`,
          userId: null,
          updatedAt: now,
        })
        .where(
          and(
            lt(sponsorshipCheckoutIntents.expiresAt, now),
            sql`(${sponsorshipCheckoutIntents.userId} IS NOT NULL OR ${sponsorshipCheckoutIntents.status} = 'pending')`,
          ),
        )
        .returning({ id: sponsorshipCheckoutIntents.id });
      return [
        removedSnapshots,
        purgedOrders,
        [...expiredClaims, ...purgedClaims],
        expiredCheckoutIntents,
      ] as const;
    },
  );
  return {
    snapshots: snapshots.length,
    orders: orders.length,
    claims: claims.length,
    checkoutIntents: checkoutIntents.length,
  };
}

export async function getSponsorshipClientConfig() {
  const config = await getAfdianSponsorshipConfig();
  const providerConfigured = (() => {
    try {
      return requireSponsorshipProvider().isConfigured();
    } catch {
      return false;
    }
  })();
  return {
    provider: providerConfigured ? ('afdian' as const) : null,
    enabled:
      providerConfigured &&
      config.acceptingCheckout &&
      isAutomaticFulfillmentEnabled(),
    fulfillmentEnabled: isAutomaticFulfillmentEnabled(),
    creatorUrl: config.creatorUrl,
    acceptingCustomAmount: config.acceptingCustomAmount,
    tiers: Object.fromEntries(
      Object.entries(config.tiers).map(([id, tier]) => [
        id,
        {
          id,
          ...SPONSORSHIP_TIER_META[id as SponsorshipTierId],
          configured: Boolean(tier.planId),
          minimumAmountFen: tier.minimumAmountFen,
        },
      ]),
    ),
  };
}

export async function getCultivatorMerit(cultivatorId: string) {
  const [profile, records, pending] = await Promise.all([
    db.query.sponsorshipMeritProfiles.findFirst({
      where: eq(sponsorshipMeritProfiles.cultivatorId, cultivatorId),
    }),
    db.query.sponsorshipMeritRecords.findMany({
      where: and(
        eq(sponsorshipMeritRecords.cultivatorId, cultivatorId),
        isNull(sponsorshipMeritRecords.revokedAt),
      ),
      orderBy: [desc(sponsorshipMeritRecords.supportedAt)],
      limit: 100,
    }),
    db.query.sponsorshipCheckoutIntents.findMany({
      columns: {
        id: true,
        tier: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
      where: and(
        eq(sponsorshipCheckoutIntents.cultivatorId, cultivatorId),
        eq(sponsorshipCheckoutIntents.status, 'pending'),
      ),
      orderBy: [desc(sponsorshipCheckoutIntents.createdAt)],
      limit: 5,
    }),
  ]);
  return {
    profile,
    records: records.map((record) => ({
      id: record.id,
      tier: record.tier,
      supportedAt: record.supportedAt,
      source: record.source,
    })),
    pending,
  };
}

export async function listPublicMeritProfiles(page: number, pageSize: number) {
  const tierRank = sql<number>`CASE ${sponsorshipMeritProfiles.highestTier}
    WHEN 'immortality_witness' THEN 3
    WHEN 'night_guardian' THEN 2
    WHEN 'fellow_traveler' THEN 1
    ELSE 0 END`;
  const where = eq(sponsorshipMeritProfiles.isPublic, true);
  const [totalRow, rows] = await Promise.all([
    db.select({ value: count() }).from(sponsorshipMeritProfiles).where(where),
    db
      .select({
        cultivatorId: sponsorshipMeritProfiles.cultivatorId,
        name: cultivators.name,
        title: cultivators.title,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        highestTier: sponsorshipMeritProfiles.highestTier,
        firstSupportedAt: sponsorshipMeritProfiles.firstSupportedAt,
      })
      .from(sponsorshipMeritProfiles)
      .innerJoin(
        cultivators,
        eq(cultivators.id, sponsorshipMeritProfiles.cultivatorId),
      )
      .where(where)
      .orderBy(
        desc(tierRank),
        asc(sponsorshipMeritProfiles.firstSupportedAt),
        asc(sponsorshipMeritProfiles.cultivatorId),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  return {
    items: rows.map((row) => {
      const { firstSupportedAt, ...publicRow } = row;
      return {
        ...publicRow,
        firstSupportedMonth: formatSponsorshipMonth(firstSupportedAt),
        cardTheme: SPONSORSHIP_TIER_META[row.highestTier].theme,
      };
    }),
    total: totalRow[0]?.value ?? 0,
    page,
    pageSize,
  };
}

export async function updateMeritVisibility(
  cultivatorId: string,
  isPublic: boolean,
): Promise<boolean> {
  const [updated] = await db
    .update(sponsorshipMeritProfiles)
    .set({ isPublic, updatedAt: new Date() })
    .where(eq(sponsorshipMeritProfiles.cultivatorId, cultivatorId))
    .returning({ cultivatorId: sponsorshipMeritProfiles.cultivatorId });
  return Boolean(updated);
}

export async function getCheckoutIntentStatus(args: {
  id: string;
  userId: string;
}) {
  return (
    (await db.query.sponsorshipCheckoutIntents.findFirst({
      columns: {
        id: true,
        tier: true,
        status: true,
        expiresAt: true,
        providerOrderId: true,
      },
      where: and(
        eq(sponsorshipCheckoutIntents.id, args.id),
        eq(sponsorshipCheckoutIntents.userId, args.userId),
      ),
    })) ?? null
  );
}

export async function reconcileAfdianOrders(
  options: {
    pages?: number;
    perPage?: number;
  } = {},
): Promise<{
  scanned: number;
  inserted: number;
  ignoredPreActivation: number;
}> {
  const provider = requireSponsorshipProvider();
  const config = await getAfdianSponsorshipConfig();
  const pages = Math.max(1, Math.min(options.pages ?? 2, 50));
  const perPage = Math.max(1, Math.min(options.perPage ?? 100, 100));
  let scanned = 0;
  let inserted = 0;
  let ignoredPreActivation = 0;
  for (let page = 1; page <= pages; page += 1) {
    const orders = await provider.listOrders(page, perPage);
    scanned += orders.length;
    for (const order of orders) {
      if (order.status !== 2) continue;
      if (!isSponsorshipOrderAccepted(order.createdAt, config)) {
        ignoredPreActivation += 1;
        continue;
      }
      const result = await recordReconciledOrder(order);
      if (result.inserted) inserted += 1;
    }
    if (orders.length < perPage) break;
  }
  return { scanned, inserted, ignoredPreActivation };
}

export async function retryPendingSponsorshipWork(): Promise<number> {
  const rows = await db.query.sponsorshipOrders.findMany({
    columns: { id: true },
    where: sql`${sponsorshipOrders.fulfillmentStatus} IN ('pending', 'linked', 'awaiting_claim', 'retry_wait')`,
    orderBy: [asc(sponsorshipOrders.updatedAt)],
    limit: 200,
  });
  for (const row of rows) {
    try {
      await processSponsorshipOrder(row.id);
    } catch (error) {
      console.error('[sponsorship-retry] order failed', {
        orderId: row.id,
        error,
      });
    }
  }
  return rows.length;
}

async function auditSponsorshipAdminAction(args: {
  adminUserId: string;
  action: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(sponsorshipAdminActions).values({
    adminUserId: args.adminUserId,
    action: args.action,
    orderId: args.orderId,
    metadata: args.metadata ?? {},
  });
}

export async function updateSponsorshipConfigAsAdmin(args: {
  adminUserId: string;
  config: Awaited<ReturnType<typeof getAfdianSponsorshipConfig>>;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await upsertAfdianSponsorshipConfig(
      {
        config: args.config,
        updatedBy: args.adminUserId,
      },
      tx,
    );
    await tx.insert(sponsorshipAdminActions).values({
      adminUserId: args.adminUserId,
      action: 'update_config',
      metadata: {
        tiers: args.config.tiers,
        ordersAcceptedAfter: args.config.ordersAcceptedAfter,
      },
    });
  });
}

export type SponsorshipAdminOrderFilter =
  'all' | 'attention' | 'awaiting_claim' | 'fulfilled' | 'revoked';

export async function listSponsorshipOrdersForAdmin(args: {
  page: number;
  pageSize: number;
  filter: SponsorshipAdminOrderFilter;
}) {
  const where =
    args.filter === 'all'
      ? undefined
      : args.filter === 'attention'
        ? sql`${sponsorshipOrders.verificationStatus} = 'needs_attention' OR ${sponsorshipOrders.fulfillmentStatus} IN ('retry_wait', 'needs_attention')`
        : eq(sponsorshipOrders.fulfillmentStatus, args.filter);
  const [items, totalRows] = await Promise.all([
    db.query.sponsorshipOrders.findMany({
      where,
      orderBy: [desc(sponsorshipOrders.createdAt)],
      limit: args.pageSize,
      offset: (args.page - 1) * args.pageSize,
    }),
    db.select({ value: count() }).from(sponsorshipOrders).where(where),
  ]);
  return {
    items,
    total: totalRows[0]?.value ?? 0,
    page: args.page,
    pageSize: args.pageSize,
  };
}

export async function getSponsorshipOrderForAdmin(orderId: string) {
  const [order, claims, records, snapshots] = await Promise.all([
    db.query.sponsorshipOrders.findFirst({
      where: eq(sponsorshipOrders.id, orderId),
    }),
    db.query.sponsorshipClaims.findMany({
      columns: {
        id: true,
        version: true,
        status: true,
        expiresAt: true,
        cultivatorId: true,
        claimedAt: true,
        messageStatus: true,
        messageAttempts: true,
        lastMessageError: true,
        createdAt: true,
        updatedAt: true,
      },
      where: eq(sponsorshipClaims.orderId, orderId),
    }),
    db.query.sponsorshipMeritRecords.findMany({
      columns: {
        id: true,
        cultivatorId: true,
        tier: true,
        source: true,
        supportedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      where: eq(sponsorshipMeritRecords.orderId, orderId),
    }),
    db.query.sponsorshipOrderSnapshots.findMany({
      columns: {
        id: true,
        source: true,
        purgeAfter: true,
        createdAt: true,
      },
      where: eq(sponsorshipOrderSnapshots.orderId, orderId),
      orderBy: [desc(sponsorshipOrderSnapshots.createdAt)],
    }),
  ]);
  return order ? { order, claims, records, snapshots } : null;
}

export async function retrySponsorshipOrderAsAdmin(
  orderId: string,
  adminUserId: string,
) {
  const order = await db.query.sponsorshipOrders.findFirst({
    columns: { fulfillmentStatus: true },
    where: eq(sponsorshipOrders.id, orderId),
  });
  if (!order) {
    throw new SponsorshipApplicationError(
      '赞助订单不存在',
      'SPONSORSHIP_ORDER_NOT_FOUND',
      404,
    );
  }
  if (order.fulfillmentStatus === 'revoked') {
    throw new SponsorshipApplicationError(
      '已撤销订单不能重试',
      'SPONSORSHIP_ORDER_REVOKED',
      409,
    );
  }
  await auditSponsorshipAdminAction({
    adminUserId,
    action: 'retry_order',
    orderId,
  });
  await processSponsorshipOrder(orderId);
}

export async function revealSponsorshipSnapshot(args: {
  snapshotId: string;
  adminUserId: string;
}) {
  const snapshot = await db.query.sponsorshipOrderSnapshots.findFirst({
    where: eq(sponsorshipOrderSnapshots.id, args.snapshotId),
  });
  if (!snapshot) return null;
  await auditSponsorshipAdminAction({
    adminUserId: args.adminUserId,
    action: 'reveal_snapshot',
    orderId: snapshot.orderId,
    metadata: { snapshotId: snapshot.id, source: snapshot.source },
  });
  return snapshot.payload;
}

export async function rotateSponsorshipClaimAsAdmin(
  orderId: string,
  adminUserId: string,
) {
  await withRedisLock(
    {
      key: redisLockKeys.sponsorshipOrder(orderId),
      context: 'sponsorship-admin-rotate-claim',
      timeoutMs: 60_000,
      retries: 1,
    },
    async (orderLease) => {
      const order = await db.query.sponsorshipOrders.findFirst({
        columns: {
          verificationStatus: true,
          fulfillmentStatus: true,
          resolvedTier: true,
        },
        where: eq(sponsorshipOrders.id, orderId),
      });
      if (!order) {
        throw new SponsorshipApplicationError(
          '赞助订单不存在',
          'SPONSORSHIP_ORDER_NOT_FOUND',
          404,
        );
      }
      if (
        order.verificationStatus !== 'verified' ||
        !order.resolvedTier ||
        !['awaiting_claim', 'retry_wait', 'needs_attention'].includes(
          order.fulfillmentStatus,
        )
      ) {
        throw new SponsorshipApplicationError(
          '该订单当前不能轮换认领码',
          'SPONSORSHIP_CLAIM_ROTATION_FORBIDDEN',
          409,
        );
      }
      const code = newClaimCode();
      const claim = await db.transaction(async (tx) => {
        const [updatedClaim] = await tx
          .update(sponsorshipClaims)
          .set({
            codeHash: hashSponsorshipClaimCode(code),
            code,
            publicListing: true,
            version: sql`${sponsorshipClaims.version} + 1`,
            status: 'active',
            cultivatorId: null,
            claimedAt: null,
            expiresAt: new Date(Date.now() + CLAIM_RETENTION_MS),
            messageStatus: 'pending',
            lastMessageError: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(sponsorshipClaims.orderId, orderId),
              inArray(sponsorshipClaims.status, ['active', 'expired']),
            ),
          )
          .returning({ id: sponsorshipClaims.id });
        if (!updatedClaim) return null;
        await tx
          .update(sponsorshipOrders)
          .set({
            fulfillmentStatus: 'awaiting_claim',
            lastErrorCode: null,
            lastErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(sponsorshipOrders.id, orderId));
        await tx.insert(sponsorshipAdminActions).values({
          adminUserId,
          action: 'rotate_claim',
          orderId,
          metadata: {},
        });
        return updatedClaim;
      });
      if (!claim) {
        throw new SponsorshipApplicationError(
          '认领码不存在、已被使用或不可轮换',
          'SPONSORSHIP_CLAIM_NOT_FOUND',
          404,
        );
      }
      try {
        await ensureClaimAndSendMessage(orderId);
      } catch {
        throw new SponsorshipApplicationError(
          '认领码已轮换，但爱发电私信发送失败；后台会继续重试',
          'SPONSORSHIP_MESSAGE_RETRY_WAIT',
          503,
        );
      }
      orderLease.assertHeld();
    },
  );
}

async function recomputeMeritProfile(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<void> {
  const records = await tx.query.sponsorshipMeritRecords.findMany({
    where: and(
      eq(sponsorshipMeritRecords.cultivatorId, cultivatorId),
      isNull(sponsorshipMeritRecords.revokedAt),
    ),
  });
  if (records.length === 0) {
    await tx
      .delete(sponsorshipMeritProfiles)
      .where(eq(sponsorshipMeritProfiles.cultivatorId, cultivatorId));
    return;
  }
  const highestTier = highestSponsorshipTier(
    records.map((record) => record.tier),
  )!;
  const times = records.map((record) => record.supportedAt.getTime());
  const values = {
    highestTier,
    meritCount: records.length,
    firstSupportedAt: new Date(Math.min(...times)),
    lastSupportedAt: new Date(Math.max(...times)),
    updatedAt: new Date(),
  };
  await tx
    .insert(sponsorshipMeritProfiles)
    .values({ cultivatorId, ...values })
    .onConflictDoUpdate({
      target: sponsorshipMeritProfiles.cultivatorId,
      set: values,
    });
}

export async function revokeSponsorshipOrderAsAdmin(
  orderId: string,
  adminUserId: string,
) {
  await withRedisLock(
    {
      key: redisLockKeys.sponsorshipOrder(orderId),
      context: 'sponsorship-admin-revoke',
      timeoutMs: 60_000,
      retries: 1,
    },
    async (orderLease) => {
      const record = await db.query.sponsorshipMeritRecords.findFirst({
        columns: { cultivatorId: true },
        where: eq(sponsorshipMeritRecords.orderId, orderId),
      });
      const revoke = (cultivatorLease?: { assertHeld(): void }) =>
        db.transaction(async (tx) => {
          const currentRecord =
            await tx.query.sponsorshipMeritRecords.findFirst({
              where: eq(sponsorshipMeritRecords.orderId, orderId),
            });
          if (currentRecord && !currentRecord.revokedAt) {
            await tx
              .update(sponsorshipMeritRecords)
              .set({ revokedAt: new Date() })
              .where(eq(sponsorshipMeritRecords.id, currentRecord.id));
            await recomputeMeritProfile(tx, currentRecord.cultivatorId);
          }
          const [updated] = await tx
            .update(sponsorshipOrders)
            .set({
              fulfillmentStatus: 'revoked',
              revokedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(sponsorshipOrders.id, orderId))
            .returning({ id: sponsorshipOrders.id });
          if (!updated) {
            throw new SponsorshipApplicationError(
              '赞助订单不存在',
              'SPONSORSHIP_ORDER_NOT_FOUND',
              404,
            );
          }
          await tx.insert(sponsorshipAdminActions).values({
            adminUserId,
            action: 'revoke_order',
            orderId,
            metadata: {},
          });
          cultivatorLease?.assertHeld();
          orderLease.assertHeld();
        });
      if (!record) {
        await revoke();
        return;
      }
      await withRedisLock(
        {
          key: redisLockKeys.sponsorshipCultivator(record.cultivatorId),
          context: 'sponsorship-admin-revoke-cultivator',
          timeoutMs: 60_000,
          retries: 1,
        },
        (cultivatorLease) => revoke(cultivatorLease),
      );
    },
  );
}

export async function grantManualSponsorshipMerit(args: {
  cultivatorId: string;
  tier: SponsorshipTierId;
  supportedAt: Date;
  publicListing: boolean;
  sendMail: boolean;
  adminUserId: string;
}) {
  await withRedisLock(
    {
      key: redisLockKeys.sponsorshipCultivator(args.cultivatorId),
      context: 'sponsorship-admin-manual-grant',
      timeoutMs: 60_000,
      retries: 1,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const cultivator = await tx.query.cultivators.findFirst({
          columns: { id: true, name: true },
          where: eq(cultivators.id, args.cultivatorId),
        });
        if (!cultivator) {
          throw new SponsorshipApplicationError(
            '角色不存在',
            'SPONSORSHIP_CULTIVATOR_NOT_FOUND',
            404,
          );
        }
        const profile = await tx.query.sponsorshipMeritProfiles.findFirst({
          where: eq(sponsorshipMeritProfiles.cultivatorId, args.cultivatorId),
        });
        const nextHighest = highestSponsorshipTier(
          profile ? [profile.highestTier, args.tier] : [args.tier],
        )!;
        const kind = !profile
          ? 'first'
          : nextHighest !== profile.highestTier
            ? 'upgrade'
            : 'repeat';
        let mailId: string | null = null;
        if (args.sendMail) {
          const copy = buildMeritMail({
            tier: args.tier,
            cultivatorName: cultivator.name,
            kind,
            supportedAt: args.supportedAt,
          });
          mailId = (
            await MailService.sendSystemMail(
              args.cultivatorId,
              copy.title,
              copy.content,
              tx,
            )
          ).id;
        }
        await tx.insert(sponsorshipMeritRecords).values({
          cultivatorId: args.cultivatorId,
          tier: args.tier,
          source: 'manual',
          supportedAt: args.supportedAt,
          mailId,
          createdBy: args.adminUserId,
        });
        await recomputeMeritProfile(tx, args.cultivatorId);
        await tx
          .update(sponsorshipMeritProfiles)
          .set({ isPublic: args.publicListing })
          .where(eq(sponsorshipMeritProfiles.cultivatorId, args.cultivatorId));
        await tx.insert(sponsorshipAdminActions).values({
          adminUserId: args.adminUserId,
          action: 'manual_grant',
          metadata: { cultivatorId: args.cultivatorId, tier: args.tier },
        });
        lease.assertHeld();
      }),
  );
}

export async function sendSponsorshipAdminDigest(
  now = new Date(),
): Promise<number> {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const adminUserIds = getAdminUserIds();
  const idEmails =
    adminUserIds.length === 0
      ? []
      : (
          await db
            .select({ email: authUsers.email })
            .from(authUsers)
            .where(inArray(authUsers.id, adminUserIds))
        ).map((row) => row.email.trim().toLowerCase());
  const recipients = [...new Set([...configuredEmails, ...idEmails])];
  if (recipients.length === 0) return 0;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const recent = await db.query.sponsorshipOrders.findMany({
    columns: { fulfillmentStatus: true, verificationStatus: true },
    where: sql`${sponsorshipOrders.createdAt} >= ${since}`,
    limit: 10_000,
  });
  const attention = await db.query.sponsorshipOrders.findMany({
    columns: { id: true },
    where: sql`${sponsorshipOrders.verificationStatus} = 'needs_attention' OR ${sponsorshipOrders.fulfillmentStatus} IN ('retry_wait', 'needs_attention')`,
    limit: 10_000,
  });
  const fulfilled = recent.filter(
    (order) => order.fulfillmentStatus === 'fulfilled',
  ).length;
  const content = [
    `统计截止：${now.toISOString()}`,
    `过去 24 小时新订单：${recent.length}`,
    `过去 24 小时已履约：${fulfilled}`,
    `当前需人工关注：${attention.length}`,
    '',
    '请前往 /admin/sponsorship 核查异常订单。',
  ].join('\n');
  for (const email of recipients) {
    await sendViaSmtp(email, '【万界道友】爱发电功德簿日报', content);
  }
  return recipients.length;
}
