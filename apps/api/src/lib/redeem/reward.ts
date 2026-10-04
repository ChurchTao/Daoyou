import { parseMailAttachments, summarizeMailAttachments } from '@daoyou/game-rules/mail';
import type { MailAttachment } from '@daoyou/game-domain/mail';

interface RedeemCodeRewardSource {
  rewardAttachments?: unknown;
}

export function resolveRedeemCodeRewardAttachments(
  redeemCode: RedeemCodeRewardSource,
): MailAttachment[] {
  if (redeemCode.rewardAttachments !== null && redeemCode.rewardAttachments !== undefined) {
    return parseMailAttachments(redeemCode.rewardAttachments);
  }
  throw new Error('兑换码已失效');
}

export function describeRedeemCodeReward(
  redeemCode: RedeemCodeRewardSource,
): string[] {
  return summarizeMailAttachments(resolveRedeemCodeRewardAttachments(redeemCode));
}
