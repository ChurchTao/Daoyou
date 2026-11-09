import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db.js';
import { appSettings } from '@server/lib/drizzle/schema.js';
import { DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS, ItemLibraryDailyMaterialGenerationSettingsSchema, type ItemLibraryDailyMaterialGenerationSettings } from '@daoyou/contracts/application-settings';
import { APP_SETTING_KEYS, DEFAULT_COMMUNITY_QQ_GROUP_NUMBER } from '@server/lib/repositories/app-settings-config.js';
import { AfdianSponsorshipConfigSchema, type AfdianSponsorshipConfig } from '@daoyou/game-domain/sponsorship';
import { withSeededSubscriptionPlans } from '@daoyou/game-rules/sponsorship';
import { DEFAULT_AFDIAN_SPONSORSHIP_CONFIG } from '@daoyou/game-content/sponsorship/defaults';
import { eq } from 'drizzle-orm';
import { AiPricingSettingsSchema, type AiPricingSettings } from '@daoyou/contracts/admin/ai-pricing';
import { Logger } from '@nestjs/common';

const logger = new Logger('AppSettingsRepository');

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
    return withSeededSubscriptionPlans(
      AfdianSponsorshipConfigSchema.parse(JSON.parse(raw)),
    );
  } catch {
    return structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
  }
}

export async function getAiPricingSettings(): Promise<AiPricingSettings> {
  const raw = await getAppSetting(APP_SETTING_KEYS.aiModelPricing);
  if (!raw) return { models: [] };
  try {
    return AiPricingSettingsSchema.parse(JSON.parse(raw));
  } catch {
    logger.warn('Invalid ai_model_pricing_v1 settings; using default model price estimates');
    return { models: [] };
  }
}

export async function upsertAiPricingSettings(params: {
  settings: AiPricingSettings;
  updatedBy: string;
}): Promise<void> {
  const settings = AiPricingSettingsSchema.parse(params.settings);
  await upsertAppSetting({
    key: APP_SETTING_KEYS.aiModelPricing,
    value: JSON.stringify(settings),
    updatedBy: params.updatedBy,
  });
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
