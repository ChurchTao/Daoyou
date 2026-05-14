import { getExecutor } from '@server/lib/drizzle/db';
import { adminMessageTemplates } from '@server/lib/drizzle/schema';
import {
  getValidatedJson,
  requireAdmin,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import type {
  AdminChannel,
  TemplateStatus,
} from '@shared/types/admin-broadcast';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  channel: z.enum(['email', 'game_mail']),
  name: z.string().trim().min(1).max(120),
  subjectTemplate: z.string().trim().max(300).optional(),
  contentTemplate: z.string().trim().min(1).max(20000),
  defaultPayload: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .default({}),
  status: z.enum(['active', 'disabled']).default('active'),
});

const UpdateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  channel: z.enum(['email', 'game_mail']).optional(),
  subjectTemplate: z.string().trim().max(300).optional(),
  contentTemplate: z.string().trim().min(1).max(20000).optional(),
  defaultPayload: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function validateEmailSubject(
  channel: AdminChannel,
  subjectTemplate?: string | null,
): string | null {
  if (channel === 'email' && !subjectTemplate?.trim()) {
    return 'email 模板必须提供 subjectTemplate';
  }

  return null;
}

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const q = getExecutor();
  const channel = c.req.query('channel') as AdminChannel | undefined;
  const status = c.req.query('status') as TemplateStatus | undefined;
  const whereConditions: SQL<unknown>[] = [];

  if (channel === 'email' || channel === 'game_mail') {
    whereConditions.push(eq(adminMessageTemplates.channel, channel));
  }

  if (status === 'active' || status === 'disabled') {
    whereConditions.push(eq(adminMessageTemplates.status, status));
  }

  const templates = await q.query.adminMessageTemplates.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    orderBy: [desc(adminMessageTemplates.createdAt)],
  });

  return c.json({ templates });
});

router.post(
  '/',
  requireAdmin(),
  validateJson(CreateTemplateSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const q = getExecutor();
    const payload = getValidatedJson<z.infer<typeof CreateTemplateSchema>>(c);
    const subjectError = validateEmailSubject(
      payload.channel,
      payload.subjectTemplate,
    );

    if (subjectError) {
      return c.json({ error: subjectError }, 400);
    }

    const [template] = await q
      .insert(adminMessageTemplates)
      .values({
        channel: payload.channel,
        name: payload.name,
        subjectTemplate: payload.subjectTemplate,
        contentTemplate: payload.contentTemplate,
        defaultPayload: payload.defaultPayload,
        status: payload.status,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    return c.json({ success: true, template });
  },
);

router.get('/:id', requireAdmin(), async (c) => {
  const q = getExecutor();
  const id = c.req.param('id');
  const template = await q.query.adminMessageTemplates.findFirst({
    where: eq(adminMessageTemplates.id, id),
  });

  if (!template) {
    return c.json({ error: '模板不存在' }, 404);
  }

  return c.json({ template });
});

router.patch(
  '/:id',
  requireAdmin(),
  validateJson(UpdateTemplateSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const q = getExecutor();
    const id = c.req.param('id');
    const template = await q.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, id),
    });

    if (!template) {
      return c.json({ error: '模板不存在' }, 404);
    }

    const payload = getValidatedJson<z.infer<typeof UpdateTemplateSchema>>(c);
    const nextChannel = (payload.channel ?? template.channel) as AdminChannel;
    const nextSubjectTemplate =
      payload.subjectTemplate ?? template.subjectTemplate;
    const subjectError = validateEmailSubject(
      nextChannel,
      nextSubjectTemplate,
    );

    if (subjectError) {
      return c.json({ error: subjectError }, 400);
    }

    const patch: {
      name?: string;
      channel?: AdminChannel;
      subjectTemplate?: string;
      contentTemplate?: string;
      defaultPayload?: Record<string, string | number>;
      status?: TemplateStatus;
      updatedBy: string;
    } = {
      updatedBy: user.id,
    };

    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.channel !== undefined) patch.channel = payload.channel;
    if (payload.subjectTemplate !== undefined) {
      patch.subjectTemplate = payload.subjectTemplate;
    }
    if (payload.contentTemplate !== undefined) {
      patch.contentTemplate = payload.contentTemplate;
    }
    if (payload.defaultPayload !== undefined) {
      patch.defaultPayload = payload.defaultPayload;
    }
    if (payload.status !== undefined) patch.status = payload.status;

    const [updated] = await q
      .update(adminMessageTemplates)
      .set(patch)
      .where(eq(adminMessageTemplates.id, id))
      .returning();

    return c.json({ success: true, template: updated });
  },
);

router.post('/:id/toggle', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const q = getExecutor();
  const id = c.req.param('id');
  const template = await q.query.adminMessageTemplates.findFirst({
    where: eq(adminMessageTemplates.id, id),
  });

  if (!template) {
    return c.json({ error: '模板不存在' }, 404);
  }

  const nextStatus = template.status === 'active' ? 'disabled' : 'active';
  const [updated] = await q
    .update(adminMessageTemplates)
    .set({
      status: nextStatus,
      updatedBy: user.id,
    })
    .where(eq(adminMessageTemplates.id, id))
    .returning();

  return c.json({ success: true, template: updated });
});

export default router;
