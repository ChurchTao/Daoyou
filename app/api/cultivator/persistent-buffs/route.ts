import { buffTemplateRegistry } from '@/engine/buff/BuffTemplateRegistry';
import type { BuffInstanceState } from '@/engine/buff/types';
import { BuffTag } from '@/engine/buff/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivator/persistent-buffs
 * 获取当前激活的持久Buff列表（包括符箓、丹药、伤势等）
 */
export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    const persistentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];

    const persistentBuffIds = buffTemplateRegistry
      .getByTag(BuffTag.PERSISTENT)
      .map((template) => template.id);

    // Filter and enrich buff instances with template info
    const persistentBuffs = persistentStatuses
      .filter((s) => persistentBuffIds.includes(s.configId))
      .map((buff) => {
        const template = buffTemplateRegistry.get(buff.configId);
        if (!template) {
          return null;
        }

        const expiresAt = (buff.metadata?.expiresAt as number | undefined) || 0;

        return {
          id: template.id,
          instanceId: buff.instanceId,
          name: template.name,
          icon: template.icon,
          description: template.descriptionTemplate,
          usesRemaining:
            (buff.metadata?.usesRemaining as number | undefined) ?? undefined,
          expiresAt: expiresAt > 0 ? expiresAt : undefined,
        };
      })
      .filter((buff): buff is NonNullable<typeof buff> => buff !== null);

    return NextResponse.json({ buffs: persistentBuffs });
  },
);
