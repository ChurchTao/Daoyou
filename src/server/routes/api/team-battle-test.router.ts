import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { TeamBattleTestRequestSchema } from '@shared/contracts/teamBattleTest';
import { runPresetTeamBattle } from '@shared/engine/battle-team';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

/**
 * POST /api/team-battle-test/run
 *
 * 运行预设的 2v2 战斗模拟，返回战斗记录（含时间线和事件）。
 * 纯 CPU 计算，不依赖 DB/Redis/LLM。
 */
router.post('/run', requireUser(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = TeamBattleTestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  try {
    const record = runPresetTeamBattle({
      seed: parsed.data?.seed,
      maxTurns: parsed.data?.maxTurns,
      preset: parsed.data?.preset,
    });
    return c.json({ success: true, data: record });
  } catch (e) {
    return c.json(
      { success: false, error: e instanceof Error ? e.message : '战斗模拟失败' },
      500,
    );
  }
});

export default router;
