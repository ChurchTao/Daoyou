import { HttpException, Injectable } from '@nestjs/common';
import {
  archiveReputationShopItem,
  createReputationShopItem,
  listReputationShopItems,
  ReputationShopError,
  updateReputationShopItem,
} from '@server/reputation-shop/application/ReputationShopService.js';
import {
  ReputationShopItemMutationSchema,
  ReputationShopListQuerySchema,
} from '@daoyou/shared/contracts/reputationShop';

@Injectable()
export class AdminReputationShopService {
  async list(status?: string) {
    const parsed = ReputationShopListQuerySchema.safeParse({
      status: status || undefined,
    });
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    return {
      items: await listReputationShopItems({ status: parsed.data.status }),
    };
  }

  async create(userId: string, body: unknown) {
    const parsed = ReputationShopItemMutationSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    try {
      const item = await createReputationShopItem({
        input: parsed.data,
        userId,
      });
      return { success: true, item };
    } catch (error) {
      if (error instanceof ReputationShopError)
        throw new HttpException({ error: error.message }, error.status);
      throw new HttpException(
        { error: error instanceof Error ? error.message : '创建商品失败' },
        400,
      );
    }
  }

  async update(userId: string, id: string, body: unknown) {
    const parsed = ReputationShopItemMutationSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    // Keep the missing-item response outside the legacy service-error catch.
    let item;
    try {
      item = await updateReputationShopItem({ id, input: parsed.data, userId });
    } catch (error) {
      if (error instanceof ReputationShopError)
        throw new HttpException({ error: error.message }, error.status);
      throw new HttpException(
        { error: error instanceof Error ? error.message : '更新商品失败' },
        400,
      );
    }
    if (!item) throw new HttpException({ error: '商品不存在' }, 404);
    return { success: true, item };
  }

  async archive(userId: string, id: string) {
    const item = await archiveReputationShopItem({ id, userId });
    if (!item) throw new HttpException({ error: '商品不存在' }, 404);
    return { success: true, item };
  }
}
