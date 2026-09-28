import type { AppEnv } from '@server/lib/hono/types';
import { findSharedCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository';
import { combatV6ReplayView } from '@shared/combat-v6/replay';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

router.get('/:shareCode', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('shareCode'));
  if (!parsed.success) return c.json({ success: false, error: '分享链接无效' }, 404);
  const archive = await findSharedCombatV6Replay(parsed.data);
  const viewer = archive?.replay?.participants.find(
    (participant) => participant.cultivatorId === archive.shareViewerCultivatorId,
  );
  if (!archive?.replay || !viewer) return c.json({ success: false, error: '战斗回放不存在' }, 404);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    success: true,
    data: combatV6ReplayView(archive.replay, viewer.cultivatorId, viewer.userId),
  });
});

export default router;
