import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getCultivatorById } from '@server/lib/services/cultivatorService';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/:id', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: '请提供有效的敌人ID' }, 400);
  }

  try {
    const enemy = await getCultivatorById(user.id, id);

    if (!enemy) {
      return c.json({ error: '敌人角色不存在' }, 404);
    }

    const { vitality, spirit, wisdom, speed, willpower } = enemy.attributes;
    return c.json({
      success: true,
      data: {
        id: enemy.id,
        name: enemy.name,
        realm: enemy.realm,
        realm_stage: enemy.realm_stage,
        spiritual_roots: enemy.spiritual_roots,
        background: enemy.background,
        combatRating: Math.round(
          (vitality + spirit + wisdom + speed + willpower) / 5,
        ),
      },
    });
  } catch (error) {
    console.error('获取敌人数据 API 错误:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取敌人数据失败，请稍后重试'
        : '获取敌人数据失败，请稍后重试';

    return c.json({ error: errorMessage }, 500);
  }
});

export default router;
