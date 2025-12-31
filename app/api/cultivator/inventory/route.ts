import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@/lib/repositories/cultivatorRepository';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/inventory
 * 获取当前活跃角色的背包数据
 */
export const GET = withActiveCultivator(async (_req, { user, cultivator }) => {
  const [consumables, materials, artifacts] = await Promise.all([
    getCultivatorConsumables(user.id, cultivator.id),
    getCultivatorMaterials(user.id, cultivator.id),
    getCultivatorArtifacts(user.id, cultivator.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      consumables,
      materials,
      artifacts,
    },
  });
});
