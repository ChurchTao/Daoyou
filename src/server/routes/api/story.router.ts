import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getMainStoryScene,
  getMainStorySnapshot,
  getMainStorySurface,
  interactMainStorySurface,
  notifyMainStoryRuntimeEvent,
  resolveMainStoryScene,
  storyErrorStatus,
} from '@server/lib/services/StoryService';
import { STORY_SURFACE_KEYS } from '@shared/types/story';
import { Hono } from 'hono';
import { z } from 'zod';

const SceneQuerySchema = z.object({
  pathname: z.string().min(1).max(240).startsWith('/game'),
});


const SurfaceQuerySchema = z.object({
  surface: z.enum(STORY_SURFACE_KEYS),
  mapNodeId: z.string().min(1).max(100).optional(),
  npcName: z.string().min(1).max(100).optional(),
});

const SurfaceInteractSchema = z
  .object({
    interactionId: z.string().min(1).max(120),
    payload: z.record(z.string(), z.unknown()).default({}),
    requestId: z.string().uuid(),
  })
  .strict();

const ResolveSchema = z
  .object({
    nodeId: z.string().min(1).max(40),
    sceneKey: z.string().min(1).max(120),
    choiceId: z.string().min(1).max(80),
    requestId: z.string().uuid(),
  })
  .strict();

const RuntimeEventSchema = z
  .object({
    eventType: z.enum([
      'dungeon_settlement',
      'dungeon_blank_page_collected',
      'breakthrough_success',
      'v1_affairs_observed',
      'v1_herb_normal_observed',
      'v1_gate_normal_observed',
      'v1_root_investigated',
      'v1_archive_root_discussed',
      'v1_spring_moon_observed',
      'v1_auction_future_listing_opened',
      'v1_auction_future_listing_resolved',
      'v1_black_market_fragment_resolved',
      'v1_lamp_mismatch_verified',
      'v1_blank_page_route_selected',
      'v1_blank_page_elder_checked',
      'v1_blank_page_market_checked',
      'v1_archive_letters_handled',
      'v1_gate_ledger_resolved',
      'v1_pre_breakthrough_ready',
      'v1_voice_heard',
      'v1_archive_voice_reported',
    ]),
    payload: z.record(z.string(), z.unknown()).default({}),
    requestId: z.string().uuid(),
  })
  .strict();

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const story = await getMainStorySnapshot(ref.cultivatorId);
    return c.json({ success: true, data: { story } });
  } catch (error) {
    console.error('读取主线进度失败:', error);
    return c.json({ success: false, error: '读取主线进度失败' }, 500);
  }
});


router.get('/surface', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const query = SurfaceQuerySchema.parse(c.req.query());
    const data = await getMainStorySurface({
      cultivatorId: ref.cultivatorId,
      surface: query.surface,
      context: { mapNodeId: query.mapNodeId, npcName: query.npcName },
    });
    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: error.issues[0]?.message ?? '剧情插槽参数错误' },
        400,
      );
    }
    console.error('读取剧情插槽失败:', error);
    return c.json({ success: false, error: '读取剧情插槽失败' }, 500);
  }
});

router.post('/surface/interact', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const body = SurfaceInteractSchema.parse(await c.req.json());
    const data = await interactMainStorySurface({
      cultivatorId: ref.cultivatorId,
      ...body,
    });
    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: error.issues[0]?.message ?? '剧情交互参数错误' },
        400,
      );
    }
    const message = error instanceof Error ? error.message : '剧情交互失败';
    const status = storyErrorStatus(error);
    if (status === 500) console.error('剧情交互失败:', error);
    return c.json({ success: false, error: message }, status);
  }
});

router.get('/scene', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const { pathname } = SceneQuerySchema.parse(c.req.query());
    const data = await getMainStoryScene({
      cultivatorId: ref.cultivatorId,
      pathname,
    });
    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: error.issues[0]?.message ?? '查询参数错误' },
        400,
      );
    }
    console.error('读取主线场景失败:', error);
    return c.json({ success: false, error: '读取主线场景失败' }, 500);
  }
});

router.post('/resolve', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const body = ResolveSchema.parse(await c.req.json());
    const data = await resolveMainStoryScene({
      cultivatorId: ref.cultivatorId,
      ...body,
    });
    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: error.issues[0]?.message ?? '主线选择参数错误' },
        400,
      );
    }
    const message = error instanceof Error ? error.message : '推进主线失败';
    const status = storyErrorStatus(error);
    if (status === 500) console.error('推进主线失败:', error);
    return c.json({ success: false, error: message }, status);
  }
});

router.post('/runtime-event', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);

  try {
    const body = RuntimeEventSchema.parse(await c.req.json());
    const data = await notifyMainStoryRuntimeEvent({
      cultivatorId: ref.cultivatorId,
      ...body,
    });
    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: error.issues[0]?.message ?? '主线事件参数错误' },
        400,
      );
    }
    const message = error instanceof Error ? error.message : '记录主线事件失败';
    const status = storyErrorStatus(error);
    if (status === 500) console.error('记录主线事件失败:', error);
    return c.json({ success: false, error: message }, status);
  }
});

export default router;
