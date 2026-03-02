import { getRedeemPresetById } from '@/config/redeemRewardPresets';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { redeemCodeClaims, redeemCodes } from '@/lib/drizzle/schema';
import { isValidRedeemCodeFormat, normalizeRedeemCode } from '@/lib/redeem/code';
import { MailService } from '@/lib/services/MailService';
import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ClaimRedeemCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

class RedeemClaimError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string };
  return maybe.code === '23505';
}

export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const q = getExecutor();
    const body = await request.json();
    const parsed = ClaimRedeemCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数错误', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const normalizedCode = normalizeRedeemCode(parsed.data.code);
    if (!isValidRedeemCodeFormat(normalizedCode)) {
      return NextResponse.json(
        { error: '兑换码格式错误，仅支持 6-64 位大写字母数字' },
        { status: 400 },
      );
    }
    let mailId = '';

    try {
      await q.transaction(async (tx) => {
        const redeemCode = await tx.query.redeemCodes.findFirst({
          where: eq(redeemCodes.code, normalizedCode),
        });

        if (!redeemCode) {
          throw new RedeemClaimError('兑换码不存在', 404);
        }

        const now = new Date();
        if (redeemCode.status !== 'active') {
          throw new RedeemClaimError('兑换码已停用');
        }
        if (redeemCode.startsAt && redeemCode.startsAt > now) {
          throw new RedeemClaimError('兑换码尚未生效');
        }
        if (redeemCode.endsAt && redeemCode.endsAt < now) {
          throw new RedeemClaimError('兑换码已过期');
        }

        const claimed = await tx.query.redeemCodeClaims.findFirst({
          where: and(
            eq(redeemCodeClaims.redeemCodeId, redeemCode.id),
            eq(redeemCodeClaims.userId, user.id),
          ),
        });
        if (claimed) {
          throw new RedeemClaimError('该兑换码你已使用过');
        }

        const preset = getRedeemPresetById(redeemCode.rewardPresetId);
        if (!preset) {
          throw new RedeemClaimError('兑换奖励配置缺失，请联系管理员', 500);
        }

        const [reservedCode] = await tx
          .update(redeemCodes)
          .set({
            claimedCount: sql`${redeemCodes.claimedCount} + 1`,
          })
          .where(
            and(
              eq(redeemCodes.id, redeemCode.id),
              eq(redeemCodes.status, 'active'),
              sql`(${redeemCodes.startsAt} IS NULL OR ${redeemCodes.startsAt} <= NOW())`,
              sql`(${redeemCodes.endsAt} IS NULL OR ${redeemCodes.endsAt} >= NOW())`,
              sql`(${redeemCodes.totalLimit} IS NULL OR ${redeemCodes.claimedCount} < ${redeemCodes.totalLimit})`,
            ),
          )
          .returning({ id: redeemCodes.id });

        if (!reservedCode) {
          throw new RedeemClaimError('兑换码已被领完或失效');
        }

        const mail = await MailService.sendMail(
          cultivator.id,
          redeemCode.mailTitle,
          redeemCode.mailContent,
          preset.attachments,
          'reward',
          tx,
        );
        mailId = mail.id;

        await tx.insert(redeemCodeClaims).values({
          redeemCodeId: redeemCode.id,
          userId: user.id,
          cultivatorId: cultivator.id,
          mailId: mail.id,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: '该兑换码你已使用过' }, { status: 400 });
      }
      if (error instanceof RedeemClaimError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      console.error('Redeem claim error:', error);
      return NextResponse.json({ error: '兑换失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '兑换成功，奖励已通过传音玉简发放',
      mailId,
    });
  },
);
