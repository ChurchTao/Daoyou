import { playerCommandExecutor } from './CommandExecutors';
import { MailService, type MailAttachment } from './MailService';

export async function sendWeeklyRankingRewardCommand(args: {
  userId: string;
  cultivatorId: string;
  requestKey: string;
  requestFingerprint: string;
  title: string;
  content: string;
  attachments: MailAttachment[];
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'rank_weekly_rewards',
    allowEmpty: true,
    idempotency: {
      key: args.requestKey,
      fingerprint: args.requestFingerprint,
    },
    command: async (tx) => {
      const mail = await MailService.sendNewRewardMail(
        args.cultivatorId,
        args.title,
        args.content,
        args.attachments,
        'reward',
        tx,
      );
      if (!mail) {
        throw new Error('排行榜奖励邮件创建失败');
      }
      return {
        result: { mailId: mail.id },
        resourceChanges: [],
      };
    },
  });
}
