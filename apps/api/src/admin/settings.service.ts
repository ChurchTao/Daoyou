import { HttpException, Injectable } from '@nestjs/common';
import {
  AiPricingSettingsSchema,
  DEFAULT_AI_MODEL_PRICING,
  type AdminAiPricingResponse,
} from '@daoyou/contracts/admin/ai-pricing';
import {
  getAiPricingSettings,
  getAppSetting,
  getAuthPageAnnouncement,
  getResolvedCommunityQqGroupNumber,
  upsertAppSetting,
  upsertAiPricingSettings,
} from '@server/lib/repositories/appSettingsRepository.js';
import { APP_SETTING_KEYS } from '@server/lib/repositories/app-settings-config.js';
import { z } from 'zod';

const AnnouncementSchema = z.object({ announcement: z.string() });
const CommunitySchema = z.object({
  groupNumber: z
    .string()
    .trim()
    .regex(/^\d{5,12}$/, '请输入 5 到 12 位数字 QQ 群号'),
});

@Injectable()
export class SettingsService {
  async aiPricing(): Promise<AdminAiPricingResponse> {
    return {
      settings: await getAiPricingSettings(),
      defaults: DEFAULT_AI_MODEL_PRICING,
    };
  }

  async updateAiPricing(
    userId: string,
    body: unknown,
  ): Promise<AdminAiPricingResponse> {
    const parsed = AiPricingSettingsSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    await upsertAiPricingSettings({ settings: parsed.data, updatedBy: userId });
    return { settings: parsed.data, defaults: DEFAULT_AI_MODEL_PRICING };
  }

  async announcement() {
    return { announcement: (await getAuthPageAnnouncement()) ?? '' };
  }

  async updateAnnouncement(userId: string, body: unknown) {
    const parsed = AnnouncementSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    const announcement = parsed.data.announcement.trim();
    await upsertAppSetting({
      key: APP_SETTING_KEYS.authPageAnnouncement,
      value: announcement,
      updatedBy: userId,
    });
    return { ok: true, announcement };
  }

  async community() {
    const resolved = await getResolvedCommunityQqGroupNumber();
    const stored = await getAppSetting(APP_SETTING_KEYS.communityQqGroupNumber);
    return {
      groupNumber: resolved,
      customized: Boolean(stored),
      storedGroupNumber: stored,
    };
  }

  async updateCommunity(userId: string, body: unknown) {
    const parsed = CommunitySchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    await upsertAppSetting({
      key: APP_SETTING_KEYS.communityQqGroupNumber,
      value: parsed.data.groupNumber,
      updatedBy: userId,
    });
    return { ok: true, groupNumber: await getResolvedCommunityQqGroupNumber() };
  }
}
