import { HttpException, Injectable } from '@nestjs/common';
import {
  archiveSectShopItem,
  createSectShopItem,
  listSectShopItems,
  SectShopError,
  updateSectShopItem,
} from '@server/sects/application/SectShopService.js';
import { ItemExchangeShopItemMutationSchema as SectShopItemMutationSchema } from '@daoyou/game-rules/shops/exchange';
import { SectShopListQuerySchema } from '@daoyou/contracts/shops/sect';

@Injectable()
export class AdminSectShopService {
  async list(status?: string) {
    const parsed = SectShopListQuerySchema.safeParse({
      status: status || undefined,
    });
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    return { items: await listSectShopItems({ status: parsed.data.status }) };
  }

  async create(userId: string, body: unknown) {
    const parsed = SectShopItemMutationSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    try {
      const item = await createSectShopItem({ input: parsed.data, userId });
      return { success: true, item };
    } catch (error) {
      if (error instanceof SectShopError)
        throw new HttpException({ error: error.message }, error.status);
      throw new HttpException(
        { error: error instanceof Error ? error.message : '创建商品失败' },
        400,
      );
    }
  }

  async update(userId: string, id: string, body: unknown) {
    const parsed = SectShopItemMutationSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    // Keep the missing-item response outside the legacy service-error catch.
    let item;
    try {
      item = await updateSectShopItem({ id, input: parsed.data, userId });
    } catch (error) {
      if (error instanceof SectShopError)
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
    const item = await archiveSectShopItem({ id, userId });
    if (!item) throw new HttpException({ error: '商品不存在' }, 404);
    return { success: true, item };
  }
}
