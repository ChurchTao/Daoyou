import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { appSettings } from '@server/lib/drizzle/schema';
import {
  APP_SETTING_KEYS,
  DEFAULT_COMMUNITY_QQ_GROUP_NUMBER,
  DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS,
  ItemLibraryDailyMaterialGenerationSettingsSchema,
  type ItemLibraryDailyMaterialGenerationSettings,
} from '@shared/lib/constants/appSettings';
import {
  AfdianSponsorshipConfigSchema,
  DEFAULT_AFDIAN_SPONSORSHIP_CONFIG,
  type AfdianSponsorshipConfig,
} from '@shared/lib/sponsorship';
import { eq } from 'drizzle-orm';

export async function getAppSetting(key: string): Promise<string | null> {
  const q = getExecutor();
  const [row] = await q
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  const v = row?.value?.trim();
  return v ? v : null;
}

export async function upsertAppSetting(
  params: {
    key: string;
    value: string;
    updatedBy: string;
  },
  tx?: DbTransaction,
): Promise<void> {
  const q = getExecutor(tx);
  await q
    .insert(appSettings)
    .values({
      key: params.key,
      value: params.value,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: params.value,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      },
    });
}

/** Effective QQ group number for the community entry. */
export async function getResolvedCommunityQqGroupNumber(): Promise<string> {
  const fromDb = await getAppSetting(APP_SETTING_KEYS.communityQqGroupNumber);
  if (fromDb) return fromDb;
  return DEFAULT_COMMUNITY_QQ_GROUP_NUMBER;
}

export async function getAuthPageAnnouncement(): Promise<string | null> {
  return getAppSetting(APP_SETTING_KEYS.authPageAnnouncement);
}

export async function getItemLibraryDailyMaterialGenerationSettings(): Promise<ItemLibraryDailyMaterialGenerationSettings> {
  const raw = await getAppSetting(
    APP_SETTING_KEYS.itemLibraryDailyMaterialGeneration,
  );
  if (!raw) return DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS;

  try {
    const parsedJson = JSON.parse(raw);
    const parsed =
      ItemLibraryDailyMaterialGenerationSettingsSchema.safeParse(parsedJson);
    if (parsed.success) return parsed.data;
  } catch {
    // Fall through to defaults on malformed persisted settings.
  }

  return DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS;
}

export async function upsertItemLibraryDailyMaterialGenerationSettings(params: {
  settings: ItemLibraryDailyMaterialGenerationSettings;
  updatedBy: string;
}): Promise<void> {
  await upsertAppSetting({
    key: APP_SETTING_KEYS.itemLibraryDailyMaterialGeneration,
    value: JSON.stringify(params.settings),
    updatedBy: params.updatedBy,
  });
}

export async function getAfdianSponsorshipConfig(): Promise<AfdianSponsorshipConfig> {
  const raw = await getAppSetting(APP_SETTING_KEYS.afdianSponsorship);
  if (!raw) return structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
  try {
    return AfdianSponsorshipConfigSchema.parse(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
  }
}

export async function upsertAfdianSponsorshipConfig(
  params: {
    config: AfdianSponsorshipConfig;
    updatedBy: string;
  },
  tx?: DbTransaction,
): Promise<void> {
  const config = AfdianSponsorshipConfigSchema.parse(params.config);
  await upsertAppSetting(
    {
      key: APP_SETTING_KEYS.afdianSponsorship,
      value: JSON.stringify(config),
      updatedBy: params.updatedBy,
    },
    tx,
  );
}
