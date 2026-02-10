import { buffTemplateRegistry } from '@/engine/buff/BuffTemplateRegistry';
import { BuffTag } from '@/engine/buff/types';
import { CultivatorUnit } from '@/engine/cultivator/CultivatorUnit';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { cultivators } from '@/lib/drizzle/schema';
import { createMinimalCultivator } from '@/lib/repositories/cultivatorRepository';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivator/persistent-buffs
 * 获取当前激活的持久Buff列表（包括符箓、丹药、伤势等）
 *
 * 优化：自动清理过期的持久化状态
 */
export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator, db: tx }) => {
    // 将数据库记录转换为 Cultivator 对象
    const cultivatorData = createMinimalCultivator(cultivator);

    // 使用 CultivatorUnit 统一管理持久化状态
    const unit = new CultivatorUnit(cultivatorData);

    // 获取清理后的有效状态
    const validStatuses = unit.getValidPersistentStatuses();

    // 如果有过期状态需要清理，更新数据库
    if (unit.hasDirtyPersistentStatuses()) {
      await tx
        .update(cultivators)
        .set({ persistent_statuses: validStatuses })
        .where(eq(cultivators.id, cultivator.id!));
    }

    const persistentBuffIds = buffTemplateRegistry
      .getByTag(BuffTag.PERSISTENT)
      .map((template) => template.id);

    // Filter and enrich buff instances with template info
    const persistentBuffs = validStatuses
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
