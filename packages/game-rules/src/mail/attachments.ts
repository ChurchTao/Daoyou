import { createMailAttachmentSchemas } from '@daoyou/game-domain/mail';

import type { ResourceOperation } from '@daoyou/game-domain/resources';

import type { MailAttachment } from '@daoyou/game-domain/mail';

import { BeastTransferSchema } from '../beasts/trade.js';

import { MailInventoryGrantSchema } from './inventory.js';

export function parseMailAttachments(input: unknown): MailAttachment[] {
  return MailAttachmentsSchema.parse(input) as MailAttachment[];
}

export function attachmentsToResourceOperations(
  attachments: MailAttachment[],
): ResourceOperation[] {
  const gains: ResourceOperation[] = [];

  for (const item of attachments) {
    switch (item.type) {
      case 'spirit_stones':
        gains.push({ type: 'spirit_stones', value: item.quantity });
        break;
      case 'reputation':
        gains.push({ type: 'reputation', value: item.quantity });
        break;
      case 'material':
        gains.push({
          type: 'material',
          value: item.quantity,
          data: item.data,
        });
        break;
      case 'consumable':
        gains.push({
          type: 'consumable',
          value: item.quantity,
          data: item.data,
        });
        break;
      case 'artifact':
        for (let i = 0; i < (item.quantity || 1); i += 1) {
          gains.push({
            type: 'artifact',
            value: 1,
            data: item.data,
          });
        }
        break;
      case 'cultivation_exp':
        gains.push({ type: 'cultivation_exp', value: item.quantity });
        break;
      case 'comprehension_insight':
        gains.push({ type: 'comprehension_insight', value: item.quantity });
        break;
    }
  }

  return gains;
}

export function summarizeMailAttachment(attachment: MailAttachment): string {
  return `${attachment.name} x${attachment.quantity}`;
}

export function summarizeMailAttachments(
  attachments: MailAttachment[],
): string[] {
  return attachments.map((attachment) => summarizeMailAttachment(attachment));
}
export const { MailAttachmentSchema, MailAttachmentsSchema } =
  createMailAttachmentSchemas({
    BeastTransferSchema,
    MailInventoryGrantSchema,
  });
