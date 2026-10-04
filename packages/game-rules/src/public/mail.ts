/** Public mail capabilities. Keep implementation files private. */
export {
  MailInventoryGrantSchema,
  mailGiftBlockReason,
  mailLocationText,
} from '../mail/inventory.js';
export {
  SystemMailInputSchema,
  formatMailTime,
  isSystemMailInWindow,
  matchesSystemMailConditions,
  systemMailConditionSummary,
  systemMailStatusLabel,
} from '../mail/campaign.js';
export {
  MailAttachmentsSchema,
  attachmentsToResourceOperations,
  parseMailAttachments,
  summarizeMailAttachments,
} from '../mail/attachments.js';
