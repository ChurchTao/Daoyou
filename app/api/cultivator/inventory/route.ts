import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@/lib/services/cultivatorService';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/inventory
 * 获取当前活跃角色的背包数据
 */
export const GET = withActiveCultivator(async (_req, { user, cultivator }) => {
  const consumables = await getCultivatorConsumables(user.id, cultivator.id);
  const materials = await getCultivatorMaterials(user.id, cultivator.id);
  const artifacts = await getCultivatorArtifacts(user.id, cultivator.id);

  return NextResponse.json({
    success: true,
    data: {
      consumables,
      materials,
      artifacts,
    },
  });
});
