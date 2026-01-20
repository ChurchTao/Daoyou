import { withActiveCultivator } from '@/lib/api/withAuth';
import type { BuffInstanceState } from '@/engine/buff/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivator/talismans
 * 获取当前激活的符箓Buff列表
 */
export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    const persistentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];
    const talismanBuffs = persistentStatuses
      .filter((s) =>
        [
          'reshape_fate_talisman',
          'draw_gongfa_talisman',
          'draw_skill_talisman',
        ].includes(s.configId),
      )
      .map((buff) => {
        const now = Date.now();
        const expiresAt = (buff.metadata?.expiresAt as number | undefined) || 0;
        const remainingDays = Math.max(
          0,
          Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)),
        );

        const names: Record<string, string> = {
          reshape_fate_talisman: '重塑先天命格符',
          draw_gongfa_talisman: '功法抽取符',
          draw_skill_talisman: '神通抽取符',
        };

        return {
          id: buff.configId,
          instanceId: buff.instanceId,
          name: names[buff.configId] || buff.configId,
          remainingDays,
          usesRemaining: (buff.metadata?.usesRemaining as number | undefined) ?? 0,
          expiresAt,
        };
      });

    return NextResponse.json({ talismans: talismanBuffs });
  },
);
