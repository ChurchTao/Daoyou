import {
  cloneRewardCatalogItem,
  parseRewardCatalog,
  type RewardCatalogItem,
} from '@shared/lib/rewardCatalog';
import { APP_SETTING_KEYS } from '@shared/lib/constants/appSettings';
import {
  getAppSetting,
  upsertAppSetting,
} from './appSettingsRepository';

export async function getRewardCatalog(): Promise<RewardCatalogItem[]> {
  const raw = await getAppSetting(APP_SETTING_KEYS.rewardCatalog);
  if (!raw) {
    return [];
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error('奖励目录配置不是合法 JSON');
  }

  return parseRewardCatalog(parsedJson).map((item) => cloneRewardCatalogItem(item));
}

export async function upsertRewardCatalog(params: {
  catalog: RewardCatalogItem[];
  updatedBy: string;
}): Promise<void> {
  await upsertAppSetting({
    key: APP_SETTING_KEYS.rewardCatalog,
    value: JSON.stringify(params.catalog, null, 2),
    updatedBy: params.updatedBy,
  });
}
