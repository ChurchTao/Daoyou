import { APP_SETTING_KEYS } from '@/lib/constants/appSettings';
import { withAdminAuth } from '@/lib/api/adminAuth';
import {
  getAppSetting,
  getResolvedCommunityQrcodeSourceUrl,
  upsertAppSetting,
} from '@/lib/repositories/appSettingsRepository';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const PatchBodySchema = z.object({
  sourceUrl: z
    .string()
    .trim()
    .min(1, 'URL 不能为空')
    .max(2048)
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, '请输入有效的 https 图片地址'),
});

export const GET = withAdminAuth(async () => {
  const resolved = await getResolvedCommunityQrcodeSourceUrl();
  const stored = await getAppSetting(
    APP_SETTING_KEYS.communityQrcodeSourceUrl,
  );
  return NextResponse.json({
    sourceUrl: resolved,
    storedInDb: Boolean(stored),
    storedUrl: stored,
  });
});

export const PATCH = withAdminAuth(async (request: NextRequest, ctx) => {
  const raw = await request.json();
  const parsed = PatchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sourceUrl } = parsed.data;
  await upsertAppSetting({
    key: APP_SETTING_KEYS.communityQrcodeSourceUrl,
    value: sourceUrl,
    updatedBy: ctx.user.id,
  });

  const resolved = await getResolvedCommunityQrcodeSourceUrl();
  return NextResponse.json({ ok: true, sourceUrl: resolved });
});
