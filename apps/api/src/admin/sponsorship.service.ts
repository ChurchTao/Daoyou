import { HttpException, Injectable } from '@nestjs/common';
import { getAfdianSponsorshipConfig } from '@server/lib/repositories/appSettingsRepository.js';
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
} from '@server/sponsorship/application/SponsorshipApplicationService.js';
import { requireSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry.js';
import {
  AfdianSponsorshipConfigSchema,
  SPONSORSHIP_TIER_IDS,
} from '@daoyou/shared/lib/sponsorship';
import { z } from 'zod';

const TierConfigSchema = z
  .object({
    planId: z.string().trim().max(80),
    minimumAmountFen: z.number().int().min(1).max(100000000),
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
function sponsorshipErrorResponse(error: unknown) {
  if (error instanceof SponsorshipApplicationError) {
    throw new HttpException(
      { error: error.message, code: error.code },
      error.status,
    );
  }
  throw error;
}
@Injectable()
export class AdminSponsorshipService {
  async config() {
    return await getAfdianSponsorshipConfig();
  }
  async updateConfig(userId: string, inputBody: unknown) {
    const parsed = ConfigUpdateSchema.safeParse(inputBody);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
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
      throw new HttpException(
        { error: '档位配置错误', details: nextConfig.error.flatten() },
        400,
      );
    }
    await updateSponsorshipConfigAsAdmin({
      config: nextConfig.data,
      adminUserId: userId,
    });
    return { success: true };
  }
  async ping() {
    try {
      await requireSponsorshipProvider().ping();
      return { success: true };
    } catch {
      throw new HttpException(
        { error: '爱发电连接测试失败，请检查服务端配置' },
        502,
      );
    }
  }
  async orders(query: Record<string, string | undefined>) {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(50),
        filter: z
          .enum(['all', 'attention', 'awaiting_claim', 'fulfilled', 'revoked'])
          .default('all'),
      })
      .safeParse(query);
    if (!parsed.success)
      throw new HttpException({ error: '查询参数错误' }, 400);
    const result = await listSponsorshipOrdersForAdmin(parsed.data);
    return {
      orders: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
  async detail(idParam: string) {
    const id = z.uuid().safeParse(idParam);
    if (!id.success) throw new HttpException({ error: '订单不存在' }, 404);
    const detail = await getSponsorshipOrderForAdmin(id.data);
    if (!detail) throw new HttpException({ error: '订单不存在' }, 404);
    return detail;
  }
  async retry(userId: string, idParam: string) {
    const id = z.uuid().safeParse(idParam);
    if (!id.success) throw new HttpException({ error: '订单不存在' }, 404);
    try {
      await retrySponsorshipOrderAsAdmin(id.data, userId);
      return { success: true };
    } catch (error) {
      return sponsorshipErrorResponse(error);
    }
  }
  async revoke(userId: string, idParam: string) {
    const id = z.uuid().safeParse(idParam);
    if (!id.success) throw new HttpException({ error: '订单不存在' }, 404);
    try {
      await revokeSponsorshipOrderAsAdmin(id.data, userId);
      return { success: true };
    } catch (error) {
      return sponsorshipErrorResponse(error);
    }
  }
  async rotateClaim(userId: string, idParam: string) {
    const id = z.uuid().safeParse(idParam);
    if (!id.success) throw new HttpException({ error: '订单不存在' }, 404);
    try {
      await rotateSponsorshipClaimAsAdmin(id.data, userId);
      return { success: true };
    } catch (error) {
      return sponsorshipErrorResponse(error);
    }
  }
  async reveal(userId: string, idParam: string) {
    const id = z.uuid().safeParse(idParam);
    if (!id.success) throw new HttpException({ error: '快照不存在' }, 404);
    const snapshot = await revealSponsorshipSnapshot({
      snapshotId: id.data,
      adminUserId: userId,
    });
    if (snapshot === null)
      throw new HttpException({ error: '快照不存在' }, 404);
    return { snapshot };
  }
  async grant(userId: string, inputBody: unknown) {
    const parsed = ManualGrantSchema.safeParse(inputBody);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    try {
      await grantManualSponsorshipMerit({
        ...parsed.data,
        supportedAt: parsed.data.supportedAt
          ? new Date(parsed.data.supportedAt)
          : new Date(),
        adminUserId: userId,
      });
      return { success: true };
    } catch (error) {
      return sponsorshipErrorResponse(error);
    }
  }
}
