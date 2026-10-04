import type { Artifact, Consumable, Material } from '../cultivator.js';
import type { BeastTradePreview } from '../beasts/trade-preview.js';
import type { BeastTransfer } from '../beasts/trade.js';
import type { ItemGrant } from '../items/inventory.js';

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
