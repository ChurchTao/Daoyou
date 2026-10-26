import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { BeastTradePreview } from '@daoyou/game-domain/beasts';
import type { SponsorshipTierId } from '@daoyou/game-domain/sponsorship';
import { z } from 'zod';
import type { InventoryView } from './inventory.js';

const selection = (id: z.ZodType<string>) =>
  z
    .array(id)
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length, '展示对象不能重复');

export const CharacterCardSelectionSchema = z.strictObject({
  equipmentIds: selection(z.string().min(1).max(160)),
  beastIds: selection(z.uuid()),
  revision: z.number().int().nonnegative(),
});

export const CharacterCardSettingsSchema = CharacterCardSelectionSchema.extend({
  title: z.string().trim().min(2).max(8).nullable(),
});

export type CharacterCardSelection = z.infer<
  typeof CharacterCardSelectionSchema
>;
export type CharacterCardSettings = z.infer<typeof CharacterCardSettingsSchema>;
export type CharacterCardEquipment = Pick<
  InventoryView['items'][number],
  'id' | 'name' | 'definitionId' | 'instanceData' | 'quantity'
>;
export type CharacterCardBeast = BeastTradePreview & { id: string };

export type CharacterCard = {
  id: string;
  name: string;
  title: string | null;
  gender: string | null;
  realm: RealmType;
  realmStage: RealmStage;
  sectName: string | null;
  background: string | null;
  sponsorshipTier: SponsorshipTierId | null;
  equipment: CharacterCardEquipment[];
  beasts: CharacterCardBeast[];
};

export type CharacterCardSettingsView = {
  settings: CharacterCardSettings;
  card: CharacterCard;
};
