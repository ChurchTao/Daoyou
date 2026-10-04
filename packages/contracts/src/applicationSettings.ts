import { z } from 'zod';

export const DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS = {
  enabled: true,
  count: 20,
} as const;

export const ItemLibraryDailyMaterialGenerationSettingsSchema = z.object({
  enabled: z.boolean(),
  count: z.number().int().min(1).max(200),
});

export type ItemLibraryDailyMaterialGenerationSettings = z.infer<
  typeof ItemLibraryDailyMaterialGenerationSettingsSchema
>;
