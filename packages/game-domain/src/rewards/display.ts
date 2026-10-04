import type { ItemGrant } from '../items/inventory.js';

export type RewardDisplayItem = Omit<ItemGrant, 'instanceData'> & {
  name: string;
  instanceData: Exclude<ItemGrant['instanceData'], undefined> | null;
};
