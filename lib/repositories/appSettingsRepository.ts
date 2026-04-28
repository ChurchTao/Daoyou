import { eq } from 'drizzle-orm';
import {
  APP_SETTING_KEYS,
  DEFAULT_COMMUNITY_QR_CODE_SOURCE,
} from '@/lib/constants/appSettings';
import { getExecutor } from '@/lib/drizzle/db';
import { appSettings } from '@/lib/drizzle/schema';

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

export async function upsertAppSetting(params: {
  key: string;
  value: string;
  updatedBy: string;
}): Promise<void> {
  const q = getExecutor();
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

/** Effective image URL for community QR proxy (DB override or bundled default). */
export async function getResolvedCommunityQrcodeSourceUrl(): Promise<string> {
  const fromDb = await getAppSetting(
    APP_SETTING_KEYS.communityQrcodeSourceUrl,
  );
  if (fromDb) return fromDb;
  return DEFAULT_COMMUNITY_QR_CODE_SOURCE;
}
