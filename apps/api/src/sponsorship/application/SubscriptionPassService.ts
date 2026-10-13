import type { AfdianSponsorshipConfig } from '@daoyou/game-domain/sponsorship';
import {
  extendSubscriptionEnd,
  findSubscriptionPlan,
  readSubscriptionRewards,
  selectActiveSubscriptionPlan,
  sponsorshipCalendarDate,
  type SubscriptionPlanFact,
  type SubscriptionTermFact,
} from '@daoyou/game-rules/sponsorship';
import {
  materializeRewardAttachments,
  rewardAttachments,
} from '@daoyou/game-rules/rewards/materials';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  sponsorshipAdminActions,
  sponsorshipDailyGrants,
  sponsorshipMeritRecords,
  sponsorshipOrders,
  sponsorshipProviderLinks,
  sponsorshipSubscriptionTerms,
} from '@server/lib/drizzle/schema.js';
import { getAfdianSponsorshipConfig } from '@server/lib/repositories/appSettingsRepository.js';
import { requireSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry.js';
import type { ProviderSponsorPlan } from '@server/lib/sponsorship/types.js';
import { MailService } from '@server/mail/application/MailService.js';
import { and, eq, gt, gte, isNotNull, lt, ne, or } from 'drizzle-orm';
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
    planId: row.planKey,
    level: row.level,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  }));
}

export async function ensureSponsorshipProviderLink(
  tx: DbTransaction,
  args: { provider: string; providerUserId: string; cultivatorId: string },
): Promise<'ok' | 'conflict'> {
  await tx
    .insert(sponsorshipProviderLinks)
    .values({
      provider: args.provider,
      providerUserId: args.providerUserId,
      cultivatorId: args.cultivatorId,
    })
    .onConflictDoNothing();
  const link = await tx.query.sponsorshipProviderLinks.findFirst({
    where: and(
      eq(sponsorshipProviderLinks.provider, args.provider),
      eq(sponsorshipProviderLinks.providerUserId, args.providerUserId),
    ),
  });
  if (!link || link.cultivatorId !== args.cultivatorId) return 'conflict';
  return 'ok';
}

export async function findLinkedCultivator(
  provider: string,
  providerUserId: string,
): Promise<string | null> {
  const link = await db.query.sponsorshipProviderLinks.findFirst({
    columns: { cultivatorId: true },
    where: and(
      eq(sponsorshipProviderLinks.provider, provider),
      eq(sponsorshipProviderLinks.providerUserId, providerUserId),
    ),
  });
  return link?.cultivatorId ?? null;
}

async function markTermUnresolved(orderId: string, message: string): Promise<void> {
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
    return (await requireSponsorshipProvider().queryPlan(args.planId))?.productType ?? null;
  } catch {
    return null;
  }
}

function decideTermEnd(args: {
  queryFailed: boolean;
  sponsorPlan: ProviderSponsorPlan | null;
  month: number | null;
  anchor: Date;
  existingEndsAt: Date | null | undefined;
  existingPermanent: boolean;
}):
  | { kind: 'permanent'; provisional: boolean }
  | { kind: 'expire'; endsAt: Date; provisional: boolean }
  | { kind: 'unresolved' } {
  if (!args.queryFailed && args.sponsorPlan?.permanent) {
    return { kind: 'permanent', provisional: false };
  }
  if (!args.queryFailed && args.sponsorPlan?.expireTime) {
    return {
      kind: 'expire',
      endsAt: args.sponsorPlan.expireTime,
      provisional: false,
    };
  }
  if (args.existingPermanent) return { kind: 'permanent', provisional: true };
  if (args.month && args.month > 0) {
    const base =
      args.existingEndsAt && args.existingEndsAt > args.anchor
        ? args.existingEndsAt
        : args.anchor;
    return {
      kind: 'expire',
      endsAt: extendSubscriptionEnd(base, args.month),
      provisional: true,
    };
  }
  return { kind: 'unresolved' };
}

export async function syncSubscriptionTermForOrder(orderId: string): Promise<void> {
  const order = await db.query.sponsorshipOrders.findFirst({
    where: eq(sponsorshipOrders.id, orderId),
  });
  if (
    !order ||
    order.fulfillmentStatus !== 'fulfilled' ||
    order.revokedAt ||
    !order.planId ||
    !order.providerUserId
  ) {
    return;
  }
  const config = await getAfdianSponsorshipConfig();
  const plan = findSubscriptionPlan(config, order.planId);
  if (!plan) return;
  const productType = await resolveProductType({
    productType: order.productType,
    planId: order.planId,
  });
  if (productType === null) {
    await markTermUnresolved(orderId, '无法确认爱发电方案类型，订阅期限未写入');
    return;
  }
  if (productType !== 0) return;
  const link = await db.query.sponsorshipProviderLinks.findFirst({
    where: and(
      eq(sponsorshipProviderLinks.provider, order.provider),
      eq(sponsorshipProviderLinks.providerUserId, order.providerUserId),
    ),
  });
  if (!link) return;
  const anchor = order.providerCreatedAt ?? order.createdAt;
  const existing = await db.query.sponsorshipSubscriptionTerms.findFirst({
    where: and(
      eq(sponsorshipSubscriptionTerms.cultivatorId, link.cultivatorId),
      eq(sponsorshipSubscriptionTerms.afdianPlanId, order.planId),
    ),
  });
  let sponsorPlan: ProviderSponsorPlan | null = null;
  let queryFailed = false;
  try {
    const sponsors = await requireSponsorshipProvider().querySponsors([
      order.providerUserId,
    ]);
    sponsorPlan =
      sponsors
        .find((sponsor) => sponsor.userId === order.providerUserId)
        ?.plans.find((item) => item.planId === order.planId) ?? null;
  } catch {
    queryFailed = true;
  }
  const decision = decideTermEnd({
    queryFailed,
    sponsorPlan,
    month: order.month,
    anchor,
    existingEndsAt: existing?.endsAt,
    existingPermanent: Boolean(existing && existing.endsAt === null),
  });
  if (decision.kind === 'unresolved') {
    await markTermUnresolved(
      orderId,
      '爱发电未返回到期时间，且订单没有可顺延的赞助月份',
    );
    return;
  }
  const startsAt =
    existing && existing.startsAt < anchor ? existing.startsAt : anchor;
  await db
    .insert(sponsorshipSubscriptionTerms)
    .values({
      cultivatorId: link.cultivatorId,
      provider: order.provider,
      providerUserId: order.providerUserId,
      planKey: plan.id,
      level: plan.level,
      afdianPlanId: order.planId,
      startsAt,
      endsAt: decision.kind === 'permanent' ? null : decision.endsAt,
      provisional: decision.provisional,
      lastSyncedAt: new Date(),
      sourceOrderId: order.id,
    })
    .onConflictDoUpdate({
      target: [
        sponsorshipSubscriptionTerms.cultivatorId,
        sponsorshipSubscriptionTerms.afdianPlanId,
      ],
      set: {
        provider: order.provider,
        providerUserId: order.providerUserId,
        planKey: plan.id,
        level: plan.level,
        startsAt,
        endsAt: decision.kind === 'permanent' ? null : decision.endsAt,
        provisional: decision.provisional,
        lastSyncedAt: new Date(),
        sourceOrderId: order.id,
        updatedAt: new Date(),
      },
    });
  if (order.lastErrorCode === TERM_ERROR) {
    await db
      .update(sponsorshipOrders)
      .set({
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(sponsorshipOrders.id, order.id));
  }
}

export async function grantSubscriptionDailySupply(args: {
  cultivatorId: string;
  checkedAt: Date;
  tx: DbTransaction;
}): Promise<void> {
  const config = await getAfdianSponsorshipConfig();
  const rows = await args.tx.query.sponsorshipSubscriptionTerms.findMany({
    where: eq(sponsorshipSubscriptionTerms.cultivatorId, args.cultivatorId),
  });
  const active = selectActiveSubscriptionPlan(
    termFacts(rows),
    planFacts(config),
    args.checkedAt,
    { requireRewards: true },
  );
  if (!active) return;
  const plan = config.subscriptionPlans.find((item) => item.id === active.planId);
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
      grantDate,
      planKey: plan.id,
      level: active.level,
    })
    .onConflictDoNothing({
      target: [
        sponsorshipDailyGrants.cultivatorId,
        sponsorshipDailyGrants.grantDate,
      ],
    })
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
  const active = selectActiveSubscriptionPlan(termFacts(rows), planFacts(config), now);
  if (!active) return null;
  const grant = await db.query.sponsorshipDailyGrants.findFirst({
    columns: { id: true },
    where: and(
      eq(sponsorshipDailyGrants.cultivatorId, cultivatorId),
      eq(sponsorshipDailyGrants.grantDate, sponsorshipCalendarDate(now)),
    ),
  });
  const plan = config.subscriptionPlans.find((item) => item.id === active.planId);
  return {
    name: active.name,
    level: active.level,
    endsAt: active.endsAt ? active.endsAt.toISOString() : null,
    permanent: active.endsAt === null,
    deliveredToday: Boolean(grant),
    rewardsConfigured: active.hasRewards,
    dailyRewards: plan ? (readSubscriptionRewards(plan.dailyRewards) ?? []) : [],
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
      term.endsAt === null || term.endsAt.getTime() > sponsorPlan.expireTime.getTime();
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
    cultivatorId: string;
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
    const meritCultivators = new Set<string>();
    for (const order of subscriptionOrders) {
      const record = await db.query.sponsorshipMeritRecords.findFirst({
        columns: { cultivatorId: true },
        where: eq(sponsorshipMeritRecords.orderId, order.id),
      });
      if (record) meritCultivators.add(record.cultivatorId);
    }
    const linked = await findLinkedCultivator('afdian', userId);
    const cultivatorId =
      meritCultivators.size === 1
        ? [...meritCultivators][0]!
        : meritCultivators.size === 0
          ? linked
          : null;
    if (!cultivatorId || (linked && linked !== cultivatorId)) {
      skipped += 1;
      continue;
    }
    ready.push({ userId, cultivatorId, orders: subscriptionOrders });
  }
  let sponsors: Map<string, ProviderSponsorPlan[]>;
  try {
    sponsors = await sponsorPlansByUser(ready.map((item) => item.userId));
  } catch (error) {
    console.error('[sponsorship-pass] historical sponsor query failed', { error });
    return { users: grouped.size, updated: 0, skipped: grouped.size };
  }
  for (const item of ready) {
    const plans = sponsors.get(item.userId);
    if (!plans) {
      skipped += 1;
      continue;
    }
    await db.transaction(async (tx) => {
      const link = await ensureSponsorshipProviderLink(tx, {
        provider: 'afdian',
        providerUserId: item.userId,
        cultivatorId: item.cultivatorId,
      });
      if (link === 'conflict') return;
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
        const startsAt = planOrders.reduce(
          (earliest, order) => {
            const at = order.providerCreatedAt ?? order.createdAt;
            return at < earliest ? at : earliest;
          },
          planOrders[0]!.providerCreatedAt ?? planOrders[0]!.createdAt,
        );
        const source =
          planOrders.toSorted(
            (left, right) =>
              (right.providerCreatedAt ?? right.createdAt).getTime() -
              (left.providerCreatedAt ?? left.createdAt).getTime(),
          )[0] ?? planOrders[0]!;
        await tx
          .insert(sponsorshipSubscriptionTerms)
          .values({
            cultivatorId: item.cultivatorId,
            provider: 'afdian',
            providerUserId: item.userId,
            planKey: catalog.id,
            level: catalog.level,
            afdianPlanId,
            startsAt,
            endsAt: sponsorPlan.permanent ? null : sponsorPlan.expireTime,
            provisional: false,
            lastSyncedAt: new Date(),
            sourceOrderId: source.id,
          })
          .onConflictDoUpdate({
            target: [
              sponsorshipSubscriptionTerms.cultivatorId,
              sponsorshipSubscriptionTerms.afdianPlanId,
            ],
            set: {
              planKey: catalog.id,
              level: catalog.level,
              providerUserId: item.userId,
              startsAt,
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

export async function rebindSponsorshipProviderUser(args: {
  adminUserId: string;
  providerUserId: string;
  cultivatorId: string;
}): Promise<void> {
  const cultivator = await db.query.cultivators.findFirst({
    columns: { id: true },
    where: eq(cultivators.id, args.cultivatorId),
  });
  if (!cultivator) throw new SubscriptionPassError('角色不存在', 404);
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(sponsorshipProviderLinks)
        .values({
          provider: 'afdian',
          providerUserId: args.providerUserId,
          cultivatorId: args.cultivatorId,
          reboundBy: args.adminUserId,
        })
        .onConflictDoUpdate({
          target: [
            sponsorshipProviderLinks.provider,
            sponsorshipProviderLinks.providerUserId,
          ],
          set: {
            cultivatorId: args.cultivatorId,
            reboundBy: args.adminUserId,
            updatedAt: new Date(),
          },
        });
      await tx
        .update(sponsorshipSubscriptionTerms)
        .set({ cultivatorId: args.cultivatorId, updatedAt: new Date() })
        .where(
          and(
            eq(sponsorshipSubscriptionTerms.provider, 'afdian'),
            eq(sponsorshipSubscriptionTerms.providerUserId, args.providerUserId),
          ),
        );
      await tx.insert(sponsorshipAdminActions).values({
        adminUserId: args.adminUserId,
        action: 'rebind_provider_user',
        metadata: {
          providerUserId: args.providerUserId,
          cultivatorId: args.cultivatorId,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('sponsorship_terms_cultivator_plan_uidx')) {
      throw new SubscriptionPassError(
        '目标角色已有同一爱发电方案的订阅期限',
        409,
      );
    }
    throw error;
  }
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
    .delete(sponsorshipSubscriptionTerms)
    .where(
      and(
        eq(sponsorshipSubscriptionTerms.provider, order.provider),
        eq(sponsorshipSubscriptionTerms.providerUserId, order.providerUserId),
        eq(sponsorshipSubscriptionTerms.afdianPlanId, order.planId),
      ),
    );
}
