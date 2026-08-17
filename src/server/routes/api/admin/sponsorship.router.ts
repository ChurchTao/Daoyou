import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getAfdianSponsorshipConfig } from '@server/lib/repositories/appSettingsRepository';
import {
  getSponsorshipOrderForAdmin,
  grantManualSponsorshipMerit,
  listSponsorshipOrdersForAdmin,
  retrySponsorshipOrderAsAdmin,
  revealSponsorshipSnapshot,
  revokeSponsorshipOrderAsAdmin,
  rotateSponsorshipClaimAsAdmin,
  SponsorshipApplicationError,
  updateSponsorshipConfigAsAdmin,
} from '@server/lib/services/SponsorshipApplicationService';
import { requireSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry';
import {
  AfdianSponsorshipConfigSchema,
  SPONSORSHIP_TIER_IDS,
} from '@shared/lib/sponsorship';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const TierConfigSchema = z
  .object({
    planId: z.string().trim().max(80),
    minimumAmountFen: z.number().int().min(1).max(100_000_000),
  })
  .strict();

const ConfigUpdateSchema = z
  .object({
    tiers: z.object({
      faint_light: TierConfigSchema,
      fellow_traveler: TierConfigSchema,
      night_guardian: TierConfigSchema,
      immortality_witness: TierConfigSchema,
    }),
  })
  .strict();

const ManualGrantSchema = z
  .object({
    cultivatorId: z.uuid(),
    tier: z.enum(SPONSORSHIP_TIER_IDS),
    supportedAt: z.string().datetime().optional(),
    publicListing: z.boolean().default(true),
    sendMail: z.boolean().default(true),
  })
  .strict();

const router = new Hono<AppEnv>();
router.use('*', requireAdmin());

function sponsorshipErrorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof SponsorshipApplicationError) {
    return c.json({ error: error.message, code: error.code }, error.status);
  }
  throw error;
}

router.get('/config', async (c) => c.json(await getAfdianSponsorshipConfig()));

router.put('/config', async (c) => {
  const user = c.get('user')!;
  const parsed = ConfigUpdateSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  const current = await getAfdianSponsorshipConfig();
  const acceptingCheckout = Object.values(parsed.data.tiers).some(
    (tier) => tier.planId.length > 0,
  );
  const ordersAcceptedAfter = acceptingCheckout
    ? current.acceptingCheckout && current.ordersAcceptedAfter
      ? current.ordersAcceptedAfter
      : new Date().toISOString()
    : current.ordersAcceptedAfter;
  const nextConfig = AfdianSponsorshipConfigSchema.safeParse({
    ...current,
    acceptingCheckout,
    ordersAcceptedAfter,
    tiers: parsed.data.tiers,
  });
  if (!nextConfig.success) {
    return c.json(
      { error: '档位配置错误', details: nextConfig.error.flatten() },
      400,
    );
  }
  await updateSponsorshipConfigAsAdmin({
    config: nextConfig.data,
    adminUserId: user.id,
  });
  return c.json({ success: true });
});

router.post('/ping', async (c) => {
  try {
    await requireSponsorshipProvider().ping();
    return c.json({ success: true });
  } catch {
    return c.json({ error: '爱发电连接测试失败，请检查服务端配置' }, 502);
  }
});

router.get('/orders', async (c) => {
  const parsed = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
      filter: z
        .enum(['all', 'attention', 'awaiting_claim', 'fulfilled', 'revoked'])
        .default('all'),
    })
    .safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: '查询参数错误' }, 400);
  const result = await listSponsorshipOrdersForAdmin(parsed.data);
  return c.json({
    orders: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
});

router.get('/orders/:id', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: '订单不存在' }, 404);
  const detail = await getSponsorshipOrderForAdmin(id.data);
  return detail ? c.json(detail) : c.json({ error: '订单不存在' }, 404);
});

router.post('/orders/:id/retry', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: '订单不存在' }, 404);
  try {
    await retrySponsorshipOrderAsAdmin(id.data, c.get('user')!.id);
    return c.json({ success: true });
  } catch (error) {
    return sponsorshipErrorResponse(c, error);
  }
});

router.post('/orders/:id/revoke', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: '订单不存在' }, 404);
  try {
    await revokeSponsorshipOrderAsAdmin(id.data, c.get('user')!.id);
    return c.json({ success: true });
  } catch (error) {
    return sponsorshipErrorResponse(c, error);
  }
});

router.post('/orders/:id/rotate-claim', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: '订单不存在' }, 404);
  try {
    await rotateSponsorshipClaimAsAdmin(id.data, c.get('user')!.id);
    return c.json({ success: true });
  } catch (error) {
    return sponsorshipErrorResponse(c, error);
  }
});

router.post('/snapshots/:id/reveal', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: '快照不存在' }, 404);
  const snapshot = await revealSponsorshipSnapshot({
    snapshotId: id.data,
    adminUserId: c.get('user')!.id,
  });
  return snapshot === null
    ? c.json({ error: '快照不存在' }, 404)
    : c.json({ snapshot });
});

router.post('/manual-grants', async (c) => {
  const parsed = ManualGrantSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  try {
    await grantManualSponsorshipMerit({
      ...parsed.data,
      supportedAt: parsed.data.supportedAt
        ? new Date(parsed.data.supportedAt)
        : new Date(),
      adminUserId: c.get('user')!.id,
    });
    return c.json({ success: true }, 201);
  } catch (error) {
    return sponsorshipErrorResponse(c, error);
  }
});

export default router;
