import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import type { BeastTradePreview, BeastTransfer } from '../contracts/beastTrade';
import type { ItemGrant } from '../inventory';

export type MailAttachmentType =
  | 'beast_v1'
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
  beast?: BeastTransfer;
  beastPreview?: BeastTradePreview;
  data?: Material | Consumable | Artifact;
}
