import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  getPaginatedInventoryByType,
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@/lib/services/cultivatorService';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@/types/constants';
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

  const parseMaterialRanks = (raw: string | null): Quality[] | undefined => {
    if (!raw) return undefined;
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as Quality[];
    if (values.length === 0) return undefined;
    const validSet = new Set<Quality>(QUALITY_VALUES);
    if (values.some((v) => !validSet.has(v))) {
      throw new Error(`无效的材料品级，支持：${QUALITY_VALUES.join(', ')}`);
    }
    return values;
  };

  const parseMaterialElements = (
    raw: string | null,
  ): ElementType[] | undefined => {
    if (!raw) return undefined;
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as ElementType[];
    if (values.length === 0) return undefined;
    const validSet = new Set<ElementType>(ELEMENT_VALUES);
    if (values.some((v) => !validSet.has(v))) {
      throw new Error(`无效的材料属性，支持：${ELEMENT_VALUES.join(', ')}`);
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
    let materialRanks: Quality[] | undefined;
    let materialElements: ElementType[] | undefined;
    const materialSortBy = searchParams.get('materialSortBy');
    const materialSortOrder = searchParams.get('materialSortOrder');
    try {
      materialTypes = parseMaterialTypes(searchParams.get('materialTypes'));
      excludeMaterialTypes = parseMaterialTypes(
        searchParams.get('excludeMaterialTypes'),
      );
      materialRanks = parseMaterialRanks(searchParams.get('materialRanks'));
      materialElements = parseMaterialElements(
        searchParams.get('materialElements'),
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

    const validSortBy = [
      'createdAt',
      'rank',
      'type',
      'element',
      'quantity',
      'name',
    ] as const;
    const validSortOrder = ['asc', 'desc'] as const;
    if (
      materialSortBy &&
      !validSortBy.includes(materialSortBy as (typeof validSortBy)[number])
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的排序字段，支持：${validSortBy.join(', ')}`,
        },
        { status: 400 },
      );
    }
    if (
      materialSortOrder &&
      !validSortOrder.includes(
        materialSortOrder as (typeof validSortOrder)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的排序方向，支持：${validSortOrder.join(', ')}`,
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
      materialRanks,
      materialElements,
      materialSortBy: materialSortBy as
        | 'createdAt'
        | 'rank'
        | 'type'
        | 'element'
        | 'quantity'
        | 'name'
        | undefined,
      materialSortOrder: materialSortOrder as 'asc' | 'desc' | undefined,
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
