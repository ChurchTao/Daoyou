import { redeemCodeClaims, redeemCodes } from '@server/lib/drizzle/schema';
import { resolveRedeemCodeRewardAttachments } from '@server/lib/redeem/reward';
import { and, eq, sql } from 'drizzle-orm';
import { playerCommandExecutor } from './CommandExecutors';
import { MailService } from './MailService';

export class RedeemClaimError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
  }
}

export function claimRedeemCode(args: {
  userId: string;
  cultivatorId: string;
  code: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'redeem_code_claim',
    allowEmpty: true,
    command: async (tx) => {
      const redeemCode = await tx.query.redeemCodes.findFirst({
        where: eq(redeemCodes.code, args.code),
      });
      if (!redeemCode) throw new RedeemClaimError('兑换码不存在', 404);
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
          eq(redeemCodeClaims.userId, args.userId),
        ),
      });
      if (claimed) throw new RedeemClaimError('该兑换码你已使用过');
      let attachments;
      try {
        attachments = resolveRedeemCodeRewardAttachments(redeemCode);
      } catch (error) {
        throw new RedeemClaimError(
          error instanceof Error ? error.message : '兑换码已失效',
        );
      }
      const [reserved] = await tx
        .update(redeemCodes)
        .set({ claimedCount: sql`${redeemCodes.claimedCount} + 1` })
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
      if (!reserved) {
        throw new RedeemClaimError('兑换码已被领完或失效');
      }
      const mail = await MailService.sendNewRewardMail(
        args.cultivatorId,
        redeemCode.mailTitle,
        redeemCode.mailContent,
        attachments,
        'reward',
        tx,
      );
      await tx.insert(redeemCodeClaims).values({
        redeemCodeId: redeemCode.id,
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        mailId: mail.id,
      });
      return {
        result: {
          message: '兑换成功，奖励已通过传音玉简发放',
          mailId: mail.id,
        },
        resourceChanges: [],
      };
    },
  });
}
