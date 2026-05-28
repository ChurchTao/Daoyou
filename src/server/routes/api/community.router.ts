import type { AppEnv } from '@server/lib/hono/types';
import {
  getAuthPageAnnouncement,
  getResolvedCommunityQqGroupNumber,
} from '@server/lib/repositories/appSettingsRepository';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/qq-group', async (c) => {
  let groupNumber: string;
  try {
    groupNumber = await getResolvedCommunityQqGroupNumber();
  } catch {
    return c.json(
      { success: false, error: 'QQ 群配置暂不可用，请稍后重试' },
      503,
    );
  }

  return c.json({
    success: true,
    groupNumber,
    joinHint: '请复制群号后前往 QQ 搜索并申请加群',
  });
});

router.get('/announcement', async (c) => {
  let announcement: string | null;
  try {
    announcement = await getAuthPageAnnouncement();
  } catch {
    return c.json(
      { success: false, error: '公告配置暂不可用，请稍后重试' },
      503,
    );
  }

  return c.json({
    success: true,
    announcement,
  });
});

export default router;
