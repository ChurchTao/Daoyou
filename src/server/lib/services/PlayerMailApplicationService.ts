import { getExecutor } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import {
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import { attachmentsToResourceOperations } from '@shared/lib/itemLibrary';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import type { MailAttachment } from './MailService';
import { and, eq, inArray } from 'drizzle-orm';
import { playerCommandExecutor } from './CommandExecutors';
import { getPlayerLoadoutByCultivatorId } from '@server/lib/services/cultivator/CultivatorLoadoutReader';
import {
  readPlayerMailSummary,
} from './PlayerResourceReaderService';
import { sendPlayerMail } from './PlayerMailService';
import { readCultivatorName } from './cultivator/CultivatorFactsReader';
import { sanitizeMaterialForClient } from './materialDetailsPrivacy';

type MailActor = {
  userId: string;
  cultivatorId: string;
};

export class PlayerMailCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
  }
}

function mailClaimChanges(args: {
  eventType: string;
  unreadCount: number;
  settlement: ResourceOperationSettlement;
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.mail-summary',
      eventType: args.eventType,
      operation: 'replace',
      payload: { unreadCount: args.unreadCount },
    },
  ];
  for (const inventoryChange of args.settlement.inventoryChanges) {
    changes.push(
      inventoryChange.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.mail.claimed',
            operation: 'upsert-items',
            payload: {
              idKey: 'id',
              items: [
                inventoryChange.kind === 'materials'
                  ? sanitizeMaterialForClient(inventoryChange.item)
                  : inventoryChange.item,
              ],
            },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.mail.claimed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [inventoryChange.id] },
          } as ResourceChangeDescriptor),
    );
  }
  if (
    args.settlement.spiritStones !== undefined ||
    args.settlement.reputation !== undefined
  ) {
    changes.push({
      resourceTopic: 'player.currency',
      eventType: 'currency.mail.changed',
      operation: 'merge',
      payload: {
        ...(args.settlement.spiritStones !== undefined
          ? { spiritStones: args.settlement.spiritStones }
          : {}),
        ...(args.settlement.reputation !== undefined
          ? { reputation: args.settlement.reputation }
          : {}),
      },
    });
  }
  if (args.settlement.cultivationProgress) {
    changes.push({
      resourceTopic: 'player.progress',
      eventType: 'progress.mail.changed',
      operation: 'replace',
      payload: args.settlement.cultivationProgress,
    });
  }
  return changes;
}

export function sendCultivatorMail(args: {
  actor: MailActor;
  recipientCultivatorId: string;
  content: string;
  attachment?: Parameters<typeof sendPlayerMail>[0]['attachment'];
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'player_mail_send',
    allowEmpty: true,
    command: async (tx) => {
      const { name: senderName } = await readCultivatorName(
        args.actor.cultivatorId,
        tx,
      );
      const result = await sendPlayerMail({
        senderCultivatorId: args.actor.cultivatorId,
        senderName,
        recipientCultivatorId: args.recipientCultivatorId,
        content: args.content,
        attachment: args.attachment,
        tx,
      });
      const resourceChanges: ResourceChangeDescriptor[] = [];
      const loadout = result.inventorySettlements.some(
        (settlement) => settlement.itemType === 'artifact',
      )
        ? await getPlayerLoadoutByCultivatorId(
            args.actor.cultivatorId,
            tx,
          )
        : undefined;
      for (const settlement of result.inventorySettlements) {
        if (settlement.itemType === 'artifact') {
          resourceChanges.push(
            settlement.remaining
              ? {
                  resourceTopic: 'inventory.artifacts',
                  eventType: 'inventory.mail.sent',
                  operation: 'upsert-items',
                  payload: { idKey: 'id', items: [settlement.remaining] },
                }
              : {
                  resourceTopic: 'inventory.artifacts',
                  eventType: 'inventory.mail.sent',
                  operation: 'remove-items',
                  payload: { idKey: 'id', ids: [settlement.itemId] },
                },
          );
        } else if (settlement.itemType === 'consumable') {
          resourceChanges.push(
            settlement.remaining
                ? {
                  resourceTopic: 'inventory.consumables',
                  eventType: 'inventory.mail.sent',
                  operation: 'upsert-items',
                  payload: { idKey: 'id', items: [settlement.remaining] },
                }
              : {
                  resourceTopic: 'inventory.consumables',
                  eventType: 'inventory.mail.sent',
                  operation: 'remove-items',
                  payload: { idKey: 'id', ids: [settlement.itemId] },
                },
          );
        } else {
          resourceChanges.push(
            settlement.remaining
                ? {
                  resourceTopic: 'inventory.materials',
                  eventType: 'inventory.mail.sent',
                  operation: 'upsert-items',
                  payload: {
                    idKey: 'id',
                    items: [sanitizeMaterialForClient(settlement.remaining)],
                  },
                }
              : {
                  resourceTopic: 'inventory.materials',
                  eventType: 'inventory.mail.sent',
                  operation: 'remove-items',
                  payload: { idKey: 'id', ids: [settlement.itemId] },
                },
          );
        }
        if (settlement.itemType === 'artifact' && loadout) {
          resourceChanges.push({
            resourceTopic: 'player.loadout',
            eventType: 'loadout.mail.sent',
            operation: 'replace',
            payload: loadout,
          });
        }
      }
      return {
        result: {
          message: `已向${result.recipientName}发出传音`,
          attachmentCount: result.attachmentCount,
        },
        resourceChanges,
      };
    },
  });
}

export function claimCultivatorMail(args: {
  actor: MailActor;
  mailId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'mail-claim',
      timeoutMs: 10_000,
      retries: 0,
    },
    async (lease) => {
      const mail = await mailsQuery(args.actor.cultivatorId, args.mailId);
      if (!mail) throw new PlayerMailCommandError('Mail not found', 404);
      if (mail.isClaimed) {
        throw new PlayerMailCommandError('Already claimed', 400);
      }
      const attachments = (mail.attachments as MailAttachment[]) || [];
      const gains = attachmentsToResourceOperations(attachments);
      return playerCommandExecutor.execute<
        | { message: string }
        | { claimedMailId: string; unreadMailCount: number }
      >({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'mail_claim',
        idempotency: {
          key: `mail-claim:${args.mailId}`,
          fingerprint: `${args.actor.cultivatorId}:${args.mailId}`,
        },
        allowEmpty: attachments.length === 0,
        command: async (tx) => {
          if (attachments.length === 0) {
            return {
              result: { message: 'No attachments' },
              resourceChanges: [],
            };
          }
          const result = await resourceEngine.applyInTransaction({
            userId: args.actor.userId,
            cultivatorId: args.actor.cultivatorId,
            gain: gains,
            tx,
          });
          if (!result.success) {
            throw new Error(result.errors?.[0] || '领取失败');
          }
          const [updated] = await tx
            .update(mails)
            .set({ isClaimed: true, isRead: true })
            .where(
              and(eq(mails.id, args.mailId), eq(mails.isClaimed, false)),
            )
            .returning({ id: mails.id });
          if (!updated) throw new Error('邮件已被领取（并发冲突）');
          const mailSummary = await readPlayerMailSummary(
            args.actor.cultivatorId,
            tx,
          );
          return {
            result: {
              claimedMailId: args.mailId,
              unreadMailCount: mailSummary.unreadCount,
            },
            resourceChanges: mailClaimChanges({
              eventType: 'mail.claimed',
              unreadCount: mailSummary.unreadCount,
              settlement: result.settlement!,
            }),
          };
        },
      });
    },
  );
}

export function claimAllCultivatorMail(args: { actor: MailActor }) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'mail-claim-all',
      timeoutMs: 15_000,
      retries: 0,
    },
    async (lease) => {
      const pendingMails = await mailsQueryAll(args.actor.cultivatorId);
      const claimable = pendingMails.filter(
        (mail) => ((mail.attachments as MailAttachment[]) || []).length > 0,
      );
      const mailIds = claimable.map((mail) => mail.id);
      const gains = claimable.flatMap((mail) =>
        attachmentsToResourceOperations(
          (mail.attachments as MailAttachment[]) || [],
        ),
      );
      return playerCommandExecutor.execute<{
        claimedCount: number;
        claimedMailIds: string[];
        unreadMailCount?: number;
      }>({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'mail_claim_all',
        allowEmpty: mailIds.length === 0,
        command: async (tx) => {
          if (mailIds.length === 0) {
            return {
              result: { claimedCount: 0, claimedMailIds: [] as string[] },
              resourceChanges: [],
            };
          }
          const result = await resourceEngine.applyInTransaction({
            userId: args.actor.userId,
            cultivatorId: args.actor.cultivatorId,
            gain: gains,
            tx,
          });
          if (!result.success) {
            throw new Error(result.errors?.[0] || '一键领取失败');
          }
          const updated = await tx
            .update(mails)
            .set({ isClaimed: true, isRead: true })
            .where(
              and(inArray(mails.id, mailIds), eq(mails.isClaimed, false)),
            )
            .returning({ id: mails.id });
          if (updated.length !== mailIds.length) {
            throw new Error('部分邮件已被领取（并发冲突）');
          }
          const mailSummary = await readPlayerMailSummary(
            args.actor.cultivatorId,
            tx,
          );
          return {
            result: {
              claimedCount: mailIds.length,
              claimedMailIds: mailIds,
              unreadMailCount: mailSummary.unreadCount,
            },
            resourceChanges: mailClaimChanges({
              eventType: 'mail.claimed_all',
              unreadCount: mailSummary.unreadCount,
              settlement: result.settlement!,
            }),
          };
        },
      });
    },
  );
}

export function markCultivatorMailRead(args: {
  actor: MailActor;
  mailId: string;
}) {
  return playerCommandExecutor.execute({
    coordination: { mode: 'database-only' },
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'mail_read',
    command: async (tx) => {
      const updated = await tx
        .update(mails)
        .set({ isRead: true })
        .where(
          and(
            eq(mails.id, args.mailId),
            eq(mails.cultivatorId, args.actor.cultivatorId),
          ),
        )
        .returning({ id: mails.id });
      if (updated.length === 0) {
        throw new PlayerMailCommandError('Mail not found', 404);
      }
      const summary = await readPlayerMailSummary(
        args.actor.cultivatorId,
        tx,
      );
      return {
        result: { mailId: args.mailId, unreadMailCount: summary.unreadCount },
        resourceChanges: [
          {
            resourceTopic: 'player.mail-summary',
            eventType: 'mail.read',
            operation: 'replace',
            payload: summary,
          },
        ],
      };
    },
  });
}

export function markAllCultivatorMailRead(args: { actor: MailActor }) {
  return playerCommandExecutor.execute({
    coordination: { mode: 'database-only' },
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'mail_read_all',
    command: async (tx) => {
      const updated = await tx
        .update(mails)
        .set({ isRead: true })
        .where(
          and(
            eq(mails.cultivatorId, args.actor.cultivatorId),
            eq(mails.isRead, false),
          ),
        )
        .returning({ id: mails.id });
      const summary = await readPlayerMailSummary(
        args.actor.cultivatorId,
        tx,
      );
      return {
        result: {
          updatedCount: updated.length,
          unreadMailCount: summary.unreadCount,
        },
        resourceChanges: [
          {
            resourceTopic: 'player.mail-summary',
            eventType: 'mail.read_all',
            operation: 'replace',
            payload: summary,
          },
        ],
      };
    },
  });
}

async function mailsQuery(cultivatorId: string, mailId: string) {
  return getExecutor().query.mails.findFirst({
    where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivatorId)),
  });
}

async function mailsQueryAll(cultivatorId: string) {
  return getExecutor().query.mails.findMany({
    where: and(
      eq(mails.type, 'reward'),
      eq(mails.cultivatorId, cultivatorId),
      eq(mails.isClaimed, false),
    ),
  });
}
