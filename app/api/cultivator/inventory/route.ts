import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  getPaginatedInventoryByType,
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@/lib/services/cultivatorService';
import { MATERIAL_TYPE_VALUES, type MaterialType } from '@/types/constants';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/inventory
 * 获取当前活跃角色的背包数据
 *
 * Query Params:
 * - type: artifacts | materials | consumables（可选）
 * - page: 页码（type 存在时生效，默认 1）
 * - pageSize: 每页数量（type 存在时生效，默认 20，最大 100）
 */
export const GET = withActiveCultivator(async (req: NextRequest, { user, cultivator }) => {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type');

  const parseMaterialTypes = (
    raw: string | null,
  ): MaterialType[] | undefined => {
    if (!raw) return undefined;
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as MaterialType[];
    if (values.length === 0) return undefined;
    const validSet = new Set<MaterialType>(MATERIAL_TYPE_VALUES);
    if (values.some((v) => !validSet.has(v))) {
      throw new Error(
        `无效的材料类型，支持：${MATERIAL_TYPE_VALUES.join(', ')}`,
      );
    }
    return values;
  };

  if (type) {
    if (!['artifacts', 'materials', 'consumables'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的背包类型，仅支持 artifacts | materials | consumables',
        },
        { status: 400 },
      );
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)),
    );
    let materialTypes: MaterialType[] | undefined;
    let excludeMaterialTypes: MaterialType[] | undefined;
    try {
      materialTypes = parseMaterialTypes(searchParams.get('materialTypes'));
      excludeMaterialTypes = parseMaterialTypes(
        searchParams.get('excludeMaterialTypes'),
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '材料类型参数解析失败',
        },
        { status: 400 },
      );
    }

    const result = await getPaginatedInventoryByType(user.id, cultivator.id, {
      type: type as 'artifacts' | 'materials' | 'consumables',
      page,
      pageSize,
      materialTypes,
      excludeMaterialTypes,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }

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
