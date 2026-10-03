import {
  parseMailAttachments,
  summarizeMailAttachments,
} from '@daoyou/shared/lib/itemLibrary';
import type { MailAttachment } from '@daoyou/shared/types/mail';

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
