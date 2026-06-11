import type { Artifact, Consumable, Material } from '@shared/types/cultivator';

export type MailAttachmentType =
  | 'material'
  | 'consumable'
  | 'artifact'
  | 'spirit_stones'
  | 'reputation'
  | 'cultivation_exp'
  | 'comprehension_insight';

export interface MailAttachment {
  type: MailAttachmentType;
  name: string;
  quantity: number;
  data?: Material | Consumable | Artifact;
}
