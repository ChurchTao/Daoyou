import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import * as products from '@server/lib/repositories/creationProductRepository.js';
import type { LegacyProductType } from '@daoyou/shared/legacy/products';

@Injectable()
export class ProductsService {
  async list(
    actor: ActiveCultivatorRef,
    query: Record<string, string | undefined>,
  ) {
    const type = query.type;
    if (!type || !['skill', 'gongfa', 'artifact'].includes(type)) {
      throw new HttpException(
        { error: '请指定有效的产物类型 (skill|gongfa|artifact)' },
        400,
      );
    }
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(query.pageSize || '20', 10)),
    );
    const [total, items] = await Promise.all([
      products.countByType(actor.cultivatorId, type as LegacyProductType),
      products.findByTypeAndCultivatorPage(
        actor.cultivatorId,
        type as LegacyProductType,
        { page, pageSize },
      ),
    ]);
    const totalPages = Math.ceil(total / pageSize);
    return {
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      },
    };
  }

  async read(actor: ActiveCultivatorRef, id: string) {
    const product = await products.findById(id);
    if (!product || product.cultivatorId !== actor.cultivatorId) {
      throw new HttpException({ error: '产物不存在' }, 404);
    }
    return { success: true, data: product };
  }
}
