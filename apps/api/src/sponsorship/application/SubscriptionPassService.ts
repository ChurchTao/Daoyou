import type { AfdianSponsorshipConfig } from '@daoyou/game-domain/sponsorship';
import {
  materializeRewardAttachments,
  rewardAttachments,
} from '@daoyou/game-rules/rewards/materials';
import {
  findSubscriptionPlan,
  readSubscriptionRewards,
  resolveSubscriptionTermEnd,
  selectActiveSubscriptionPlan,
  sponsorshipCalendarDate,
  type SubscriptionPlanFact,
  type SubscriptionTermFact,
} from '@daoyou/game-rules/sponsorship';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  sponsorshipAdminActions,
  sponsorshipDailyGrants,
  sponsorshipOrders,
  sponsorshipSubscriptionTerms,
} from '@server/lib/drizzle/schema.js';
import { getAfdianSponsorshipConfig } from '@server/lib/repositories/appSettingsRepository.js';
import { requireSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry.js';
import type { ProviderSponsorPlan } from '@server/lib/sponsorship/types.js';
import { MailService } from '@server/mail/application/MailService.js';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  lt,
  ne,
  or,
} from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const TERM_ERROR = 'SUBSCRIPTION_TERM_UNRESOLVED';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export class SubscriptionPassError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = 'SubscriptionPassError';
  }
}

function planFacts(config: AfdianSponsorshipConfig): SubscriptionPlanFact[] {
  return config.subscriptionPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    enabled: plan.enabled,
    dailyRewardCount: readSubscriptionRewards(plan.dailyRewards)?.length ?? 0,
  }));
}

function termFacts(
  rows: (typeof sponsorshipSubscriptionTerms.$inferSelect)[],
): SubscriptionTermFact[] {
  return rows.map((row) => ({
    id: row.id,
    planId: row.planKey,
    level: row.level,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  }));
}

async function markTermUnresolved(
  orderId: string,
  message: string,
): Promise<void> {
  await db
    .update(sponsorshipOrders)
    .set({
      lastErrorCode: TERM_ERROR,
      lastErrorMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(sponsorshipOrders.id, orderId));
}

async function resolveProductType(args: {
  productType: number | null;
  planId: string;
}): Promise<number | null> {
  if (args.productType !== null) return args.productType;
  try {
    return (
      (await requireSponsorshipProvider().queryPlan(args.planId))
        ?.productType ?? null
    );
  } catch {
    return null;
  }
}

export async function syncSubscriptionTermForOrder(
  orderId: string,
): Promise<boolean> {
  const order = await db.query.sponsorshipOrders.findFirst({
    where: eq(sponsorshipOrders.id, orderId),
  });
  if (
    !order ||
    order.fulfillmentStatus !== 'fulfilled' ||
    order.revokedAt ||
    !order.planId ||
    !order.providerUserId ||
    !order.recipientCultivatorId
  )
    return false;
  const config = await getAfdianSponsorshipConfig();
  const plan = findSubscriptionPlan(config, order.planId);
  if (!plan) return false;
  const productType = await resolveProductType({
    productType: order.productType,
    planId: order.planId,
  });
  if (productType === null) {
    await markTermUnresolved(orderId, '无法确认爱发电方案类型，订阅期限未写入');
    return false;
  }
  if (productType !== 0) return false;
  let sponsorPlan: ProviderSponsorPlan | null = null;
  try {
    const sponsors = await requireSponsorshipProvider().querySponsors([
      order.providerUserId,
    ]);
    sponsorPlan =
      sponsors
        .find((sponsor) => sponsor.userId === order.providerUserId)
        ?.plans.find((item) => item.planId === order.planId) ?? null;
  } catch {
    // Provider downtime uses a provisional, idempotent extension below.
  }
  const anchor = order.providerCreatedAt ?? order.createdAt;
  const resolved = await db.transaction(async (tx) => {
    // Establish ownership once. Renewal and retries never change the recipient.
    await tx
      .insert(sponsorshipSubscriptionTerms)
      .values({
        cultivatorId: order.recipientCultivatorId,
        provider: order.provider,
        providerUserId: order.providerUserId!,
        planKey: plan.id,
        level: plan.level,
        afdianPlanId: order.planId!,
        startsAt: anchor,
        endsAt: anchor,
        provisional: true,
      })
      .onConflictDoNothing();
    const [existing] = await tx
      .select()
      .from(sponsorshipSubscriptionTerms)
      .where(
        and(
          eq(sponsorshipSubscriptionTerms.provider, order.provider),
          eq(
            sponsorshipSubscriptionTerms.providerUserId,
            order.providerUserId!,
          ),
          eq(sponsorshipSubscriptionTerms.afdianPlanId, order.planId!),
        ),
      )
      .for('update');
    if (!existing) throw new Error('订阅权益不存在');
    const sourceOrder = existing.sourceOrderId
      ? await tx.query.sponsorshipOrders.findFirst({
          where: eq(sponsorshipOrders.id, existing.sourceOrderId),
        })
      : null;
    const latestOrderAt = sourceOrder
      ? (sourceOrder.providerCreatedAt ?? sourceOrder.createdAt)
      : null;
    const decision = resolveSubscriptionTermEnd({
      sponsorPlan,
      month: order.month,
      anchor,
      existing: latestOrderAt
        ? { endsAt: existing.endsAt, latestOrderAt }
        : null,
    });
    if (!decision) return false;
    await tx
      .update(sponsorshipSubscriptionTerms)
      .set({
        planKey: plan.id,
        level: plan.level,
        startsAt: existing.startsAt < anchor ? existing.startsAt : anchor,
        endsAt: decision.endsAt,
        provisional: decision.provisional,
        lastSyncedAt: new Date(),
        sourceOrderId:
          latestOrderAt && latestOrderAt > anchor
            ? existing.sourceOrderId
            : order.id,
        updatedAt: new Date(),
      })
      .where(eq(sponsorshipSubscriptionTerms.id, existing.id));
    return true;
  });
  if (!resolved) {
    await markTermUnresolved(
      orderId,
      '爱发电未返回到期时间，且订单没有可顺延的赞助月份',
    );
    return false;
  }
  if (order.lastErrorCode === TERM_ERROR) {
    await db
      .update(sponsorshipOrders)
      .set({
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sponsorshipOrders.id, order.id),
          eq(sponsorshipOrders.lastErrorCode, TERM_ERROR),
        ),
      );
  }
  return true;
}

export async function grantSubscriptionDailySupply(args: {
  cultivatorId: string;
  checkedAt: Date;
  tx: DbTransaction;
}): Promise<void> {
  const config = await getAfdianSponsorshipConfig();
  // Transfer takes the same row lock, so ownership cannot change during delivery.
  const rows = await args.tx
    .select()
    .from(sponsorshipSubscriptionTerms)
    .where(eq(sponsorshipSubscriptionTerms.cultivatorId, args.cultivatorId))
    .orderBy(asc(sponsorshipSubscriptionTerms.id))
    .for('update');
  const active = selectActiveSubscriptionPlan(
    termFacts(rows),
    planFacts(config),
    args.checkedAt,
    { requireRewards: true },
  );
  if (!active) return;
  const plan = config.subscriptionPlans.find(
    (item) => item.id === active.planId,
  );
  const rewards = plan ? readSubscriptionRewards(plan.dailyRewards) : null;
  if (!plan || !rewards?.length) return;
  const [cultivator] = await args.tx
    .select({ name: cultivators.name })
    .from(cultivators)
    .where(eq(cultivators.id, args.cultivatorId))
    .limit(1);
  const grantDate = sponsorshipCalendarDate(args.checkedAt);
  const [reserved] = await args.tx
    .insert(sponsorshipDailyGrants)
    .values({
      cultivatorId: args.cultivatorId,
      subscriptionTermId: active.termId,
      grantDate,
      planKey: plan.id,
      level: active.level,
    })
    .onConflictDoNothing()
    .returning({ id: sponsorshipDailyGrants.id });
  if (!reserved) return;
  const mail = await MailService.sendMail(
    args.cultivatorId,
    `【订阅】${plan.name} · ${grantDate}`,
    [
      `${cultivator?.name ?? '道友'}道友：`,
      '',
      '感谢你对《万界道友》开发与服务器建设的支持。',
      `今日「${plan.name}」的心意已备好，请在传音中收下。`,
    ].join('\n'),
    materializeRewardAttachments(rewardAttachments(rewards), randomUUID),
    'reward',
    args.tx,
  );
  await args.tx
    .update(sponsorshipDailyGrants)
    .set({ mailId: mail.id })
    .where(eq(sponsorshipDailyGrants.id, reserved.id));
}

export async function readCultivatorSubscriptionPass(cultivatorId: string) {
  const config = await getAfdianSponsorshipConfig();
  const rows = await db.query.sponsorshipSubscriptionTerms.findMany({
    where: eq(sponsorshipSubscriptionTerms.cultivatorId, cultivatorId),
  });
  const now = new Date();
  const active = selectActiveSubscriptionPlan(
    termFacts(rows),
    planFacts(config),
    now,
  );
  if (!active) return null;
  const grant = await db.query.sponsorshipDailyGrants.findFirst({
    columns: { id: true },
    where: and(
      or(
        eq(sponsorshipDailyGrants.cultivatorId, cultivatorId),
        eq(sponsorshipDailyGrants.subscriptionTermId, active.termId),
      ),
      eq(sponsorshipDailyGrants.grantDate, sponsorshipCalendarDate(now)),
    ),
  });
  const plan = config.subscriptionPlans.find(
    (item) => item.id === active.planId,
  );
  return {
    name: active.name,
    level: active.level,
    endsAt: active.endsAt ? active.endsAt.toISOString() : null,
    permanent: active.endsAt === null,
    deliveredToday: Boolean(grant),
    rewardsConfigured: active.hasRewards,
    dailyRewards: plan
      ? (readSubscriptionRewards(plan.dailyRewards) ?? [])
      : [],
  };
}

async function sponsorPlansByUser(userIds: string[]) {
  const provider = requireSponsorshipProvider();
  const result = new Map<string, ProviderSponsorPlan[]>();
  for (let index = 0; index < userIds.length; index += 20) {
    const chunk = userIds.slice(index, index + 20);
    const sponsors = await provider.querySponsors(chunk);
    for (const sponsor of sponsors) result.set(sponsor.userId, sponsor.plans);
  }
  return result;
}

export async function reconcileSubscriptionTerms(): Promise<{
  scanned: number;
  shortened: number;
}> {
  const now = new Date();
  const soon = new Date(now.getTime() + THREE_DAYS_MS);
  const terms = await db.query.sponsorshipSubscriptionTerms.findMany({
    where: or(
      eq(sponsorshipSubscriptionTerms.provisional, true),
      and(
        gt(sponsorshipSubscriptionTerms.endsAt, now),
        lt(sponsorshipSubscriptionTerms.endsAt, soon),
      ),
    ),
  });
  const unresolved = await db.query.sponsorshipOrders.findMany({
    columns: { id: true },
    where: and(
      eq(sponsorshipOrders.fulfillmentStatus, 'fulfilled'),
      eq(sponsorshipOrders.lastErrorCode, TERM_ERROR),
    ),
    limit: 50,
  });
  for (const order of unresolved) {
    try {
      await syncSubscriptionTermForOrder(order.id);
    } catch (error) {
      console.error('[sponsorship-pass] unresolved term sync failed', {
        orderId: order.id,
        error,
      });
    }
  }
  const userIds = [...new Set(terms.map((term) => term.providerUserId))];
  if (userIds.length === 0) return { scanned: unresolved.length, shortened: 0 };
  let sponsors: Map<string, ProviderSponsorPlan[]>;
  try {
    sponsors = await sponsorPlansByUser(userIds);
  } catch (error) {
    console.error('[sponsorship-pass] sponsor reconcile failed', { error });
    return { scanned: terms.length + unresolved.length, shortened: 0 };
  }
  let shortened = 0;
  for (const term of terms) {
    const plans = sponsors.get(term.providerUserId);
    if (!plans) continue;
    const sponsorPlan = plans.find((plan) => plan.planId === term.afdianPlanId);
    if (!sponsorPlan) continue;
    if (sponsorPlan.permanent) {
      if (!term.provisional) continue;
      await db
        .update(sponsorshipSubscriptionTerms)
        .set({
          endsAt: null,
          provisional: false,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(sponsorshipSubscriptionTerms.id, term.id));
      continue;
    }
    if (!sponsorPlan.expireTime) continue;
    const correction = term.provisional;
    const earlier =
      term.endsAt === null ||
      term.endsAt.getTime() > sponsorPlan.expireTime.getTime();
    if (!correction && !earlier) continue;
    if (!correction && earlier) shortened += 1;
    await db
      .update(sponsorshipSubscriptionTerms)
      .set({
        endsAt: sponsorPlan.expireTime,
        provisional: false,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(sponsorshipSubscriptionTerms.id, term.id));
  }
  return { scanned: terms.length + unresolved.length, shortened };
}

export async function syncHistoricalSubscriptionTerms(adminUserId: string) {
  const config = await getAfdianSponsorshipConfig();
  if (!config.ordersAcceptedAfter) {
    return { users: 0, updated: 0, skipped: 0 };
  }
  const since = new Date(config.ordersAcceptedAfter);
  const orders = await db.query.sponsorshipOrders.findMany({
    where: and(
      eq(sponsorshipOrders.fulfillmentStatus, 'fulfilled'),
      eq(sponsorshipOrders.provider, 'afdian'),
      isNotNull(sponsorshipOrders.planId),
      isNotNull(sponsorshipOrders.providerUserId),
      gte(sponsorshipOrders.providerCreatedAt, since),
    ),
  });
  const grouped = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.providerUserId || !order.planId) continue;
    const list = grouped.get(order.providerUserId) ?? [];
    list.push(order);
    grouped.set(order.providerUserId, list);
  }
  const productTypes = new Map<string, number | null>();
  let updated = 0;
  let skipped = 0;
  const ready: {
    userId: string;
    orders: typeof orders;
  }[] = [];
  for (const [userId, userOrders] of grouped) {
    const subscriptionOrders = [];
    for (const order of userOrders) {
      const plan = findSubscriptionPlan(config, order.planId);
      if (!plan || !order.planId) continue;
      let productType = productTypes.get(order.planId);
      if (productType === undefined) {
        productType = await resolveProductType({
          productType: order.productType,
          planId: order.planId,
        });
        productTypes.set(order.planId, productType);
      }
      if (productType !== 0) continue;
      subscriptionOrders.push(order);
    }
    if (subscriptionOrders.length === 0) {
      skipped += 1;
      continue;
    }
    ready.push({ userId, orders: subscriptionOrders });
  }
  let sponsors: Map<string, ProviderSponsorPlan[]>;
  try {
    sponsors = await sponsorPlansByUser(ready.map((item) => item.userId));
  } catch (error) {
    console.error('[sponsorship-pass] historical sponsor query failed', {
      error,
    });
    return { users: grouped.size, updated: 0, skipped: grouped.size };
  }
  for (const item of ready) {
    const plans = sponsors.get(item.userId);
    if (!plans) {
      skipped += 1;
      continue;
    }
    await db.transaction(async (tx) => {
      const byPlan = new Map<string, typeof item.orders>();
      for (const order of item.orders) {
        if (!order.planId) continue;
        const list = byPlan.get(order.planId) ?? [];
        list.push(order);
        byPlan.set(order.planId, list);
      }
      for (const [afdianPlanId, planOrders] of byPlan) {
        const catalog = findSubscriptionPlan(config, afdianPlanId);
        const sponsorPlan = plans.find((plan) => plan.planId === afdianPlanId);
        if (!catalog || !sponsorPlan) continue;
        if (!sponsorPlan.permanent && !sponsorPlan.expireTime) continue;
        const startsAt = planOrders.reduce((earliest, order) => {
          const at = order.providerCreatedAt ?? order.createdAt;
          return at < earliest ? at : earliest;
        }, planOrders[0]!.providerCreatedAt ?? planOrders[0]!.createdAt);
        const source =
          planOrders.toSorted(
            (left, right) =>
              (right.providerCreatedAt ?? right.createdAt).getTime() -
              (left.providerCreatedAt ?? left.createdAt).getTime(),
          )[0] ?? planOrders[0]!;
        const existing = await tx.query.sponsorshipSubscriptionTerms.findFirst({
          where: and(
            eq(sponsorshipSubscriptionTerms.provider, 'afdian'),
            eq(sponsorshipSubscriptionTerms.providerUserId, item.userId),
            eq(sponsorshipSubscriptionTerms.afdianPlanId, afdianPlanId),
          ),
        });
        const firstRecipient = planOrders
          .toSorted(
            (left, right) =>
              (left.providerCreatedAt ?? left.createdAt).getTime() -
              (right.providerCreatedAt ?? right.createdAt).getTime(),
          )
          .find((order) => order.recipientCultivatorId)?.recipientCultivatorId;
        const cultivatorId = existing ? existing.cultivatorId : firstRecipient;
        if (!existing && !cultivatorId) {
          skipped += 1;
          continue;
        }
        await tx
          .insert(sponsorshipSubscriptionTerms)
          .values({
            cultivatorId,
            provider: 'afdian',
            providerUserId: item.userId,
            planKey: catalog.id,
            level: catalog.level,
            afdianPlanId,
            startsAt:
              existing && existing.startsAt < startsAt
                ? existing.startsAt
                : startsAt,
            endsAt: sponsorPlan.permanent ? null : sponsorPlan.expireTime,
            provisional: false,
            lastSyncedAt: new Date(),
            sourceOrderId: source.id,
          })
          .onConflictDoUpdate({
            target: [
              sponsorshipSubscriptionTerms.provider,
              sponsorshipSubscriptionTerms.providerUserId,
              sponsorshipSubscriptionTerms.afdianPlanId,
            ],
            set: {
              planKey: catalog.id,
              level: catalog.level,
              providerUserId: item.userId,
              startsAt:
                existing && existing.startsAt < startsAt
                  ? existing.startsAt
                  : startsAt,
              endsAt: sponsorPlan.permanent ? null : sponsorPlan.expireTime,
              provisional: false,
              lastSyncedAt: new Date(),
              sourceOrderId: source.id,
              updatedAt: new Date(),
            },
          });
        updated += 1;
      }
    });
  }
  await db.insert(sponsorshipAdminActions).values({
    adminUserId,
    action: 'sync_subscription_terms',
    metadata: { users: grouped.size, updated, skipped },
  });
  return { users: grouped.size, updated, skipped };
}

export async function listSponsorshipSubscriptionsForAdmin(
  providerUserId?: string,
) {
  const config = await getAfdianSponsorshipConfig();
  const rows = await db
    .select({
      id: sponsorshipSubscriptionTerms.id,
      providerUserId: sponsorshipSubscriptionTerms.providerUserId,
      name: sponsorshipSubscriptionTerms.planKey,
      afdianPlanId: sponsorshipSubscriptionTerms.afdianPlanId,
      cultivatorId: sponsorshipSubscriptionTerms.cultivatorId,
      cultivatorName: cultivators.name,
      endsAt: sponsorshipSubscriptionTerms.endsAt,
    })
    .from(sponsorshipSubscriptionTerms)
    .leftJoin(
      cultivators,
      eq(cultivators.id, sponsorshipSubscriptionTerms.cultivatorId),
    )
    .where(
      providerUserId
        ? eq(sponsorshipSubscriptionTerms.providerUserId, providerUserId)
        : undefined,
    )
    .orderBy(desc(sponsorshipSubscriptionTerms.updatedAt))
    .limit(200);
  return rows.map((row) => ({
    ...row,
    name:
      config.subscriptionPlans.find((plan) => plan.id === row.name)?.name ??
      row.name,
  }));
}

export async function transferSponsorshipSubscription(args: {
  adminUserId: string;
  subscriptionId: string;
  expectedCultivatorId: string | null;
  cultivatorId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [term] = await tx
      .select()
      .from(sponsorshipSubscriptionTerms)
      .where(eq(sponsorshipSubscriptionTerms.id, args.subscriptionId))
      .for('update');
    if (!term) throw new SubscriptionPassError('订阅权益不存在', 404);
    if (term.cultivatorId !== args.expectedCultivatorId) {
      throw new SubscriptionPassError('订阅归属已变化，请刷新后重试', 409);
    }
    const cultivator = await tx.query.cultivators.findFirst({
      columns: { id: true },
      where: and(
        eq(cultivators.id, args.cultivatorId),
        eq(cultivators.status, 'active'),
      ),
    });
    if (!cultivator)
      throw new SubscriptionPassError('目标角色不存在或已非活跃角色', 404);
    if (term.cultivatorId === args.cultivatorId) return;
    await tx
      .update(sponsorshipSubscriptionTerms)
      .set({ cultivatorId: args.cultivatorId, updatedAt: new Date() })
      .where(eq(sponsorshipSubscriptionTerms.id, term.id));
    await tx.insert(sponsorshipAdminActions).values({
      adminUserId: args.adminUserId,
      action: 'transfer_subscription',
      metadata: {
        subscriptionId: term.id,
        previousCultivatorId: term.cultivatorId,
        cultivatorId: args.cultivatorId,
      },
    });
  });
}

export async function releaseSubscriptionTermForRevokedOrder(
  tx: DbTransaction,
  orderId: string,
): Promise<void> {
  const order = await tx.query.sponsorshipOrders.findFirst({
    columns: { planId: true, providerUserId: true, provider: true },
    where: eq(sponsorshipOrders.id, orderId),
  });
  if (!order?.planId || !order.providerUserId) return;
  const remaining = await tx.query.sponsorshipOrders.findFirst({
    columns: { id: true },
    where: and(
      eq(sponsorshipOrders.provider, order.provider),
      eq(sponsorshipOrders.providerUserId, order.providerUserId),
      eq(sponsorshipOrders.planId, order.planId),
      eq(sponsorshipOrders.fulfillmentStatus, 'fulfilled'),
      ne(sponsorshipOrders.id, orderId),
    ),
  });
  if (remaining) return;
  await tx
    .update(sponsorshipSubscriptionTerms)
    .set({ endsAt: new Date(), provisional: false, updatedAt: new Date() })
    .where(
      and(
        eq(sponsorshipSubscriptionTerms.provider, order.provider),
        eq(sponsorshipSubscriptionTerms.providerUserId, order.providerUserId),
        eq(sponsorshipSubscriptionTerms.afdianPlanId, order.planId),
      ),
    );
}
