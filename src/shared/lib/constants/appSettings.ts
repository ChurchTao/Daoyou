import { z } from 'zod';

/** Keys for `wanjiedaoyou_app_settings.key` — keep in sync with DB migrations */
export const APP_SETTING_KEYS = {
  communityQqGroupNumber: 'community_qq_group_number',
  authPageAnnouncement: 'auth_page_announcement',
  itemLibraryDailyMaterialGeneration: 'item_library_daily_material_generation',
} as const;

/** Bundled fallback when DB has no row or row is empty. */
export const DEFAULT_COMMUNITY_QQ_GROUP_NUMBER = '1107586928';

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
