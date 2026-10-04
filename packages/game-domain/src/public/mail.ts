/** Public mail capabilities. Keep implementation files private. */
export type { MailAttachment, MailAttachmentType } from '../mail/attachment.js';
export {
  SystemMailAudienceSnapshotSchema,
  SystemMailConditionsSchema,
  mailRealmRank,
} from '../mail/audience.js';
export type {
  MailRealm,
  SystemMailAudienceSnapshot,
  SystemMailConditions,
} from '../mail/audience.js';
export { createSystemMailInputSchema } from '../mail/campaign.js';
export type {
  SystemMailCampaign,
  SystemMailInput,
  SystemMailListItem,
} from '../mail/campaign.js';
export { createMailAttachmentSchemas } from '../mail/schema.js';
