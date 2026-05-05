import { getCombatStatusTemplate } from '@/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { PersistentCombatStatusV5 } from '@/engine/battle-v5/setup/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const now = Date.now();
  const rawStatuses = (cultivator.persistent_statuses ??
    []) as PersistentCombatStatusV5[];

  const buffs = rawStatuses
    .filter((status) => {
      if (typeof status.expiresAt === 'number' && status.expiresAt <= now) {
        return false;
      }
      if (
        typeof status.usesRemaining === 'number' &&
        status.usesRemaining <= 0
      ) {
        return false;
      }
      return true;
    })
    .map((status, index) => {
      const template = getCombatStatusTemplate(status.templateId);
      return {
        id: status.templateId,
        instanceId: `${status.templateId}:${index}`,
        name: template?.name ?? status.templateId,
        icon: template?.display.icon ?? '💫',
        description: template?.description ?? '状态效果',
        usesRemaining: status.usesRemaining,
        expiresAt: status.expiresAt,
      };
    });

  return NextResponse.json({ buffs });
});
