import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import type { ItemGrant } from '../inventory';

export type MailAttachmentType =
  | 'inventory_v1'
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
  inventory?: ItemGrant;
  data?: Material | Consumable | Artifact;
}
