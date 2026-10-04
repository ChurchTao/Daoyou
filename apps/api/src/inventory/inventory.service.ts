import type {
  InventoryActionSchema,
  InventoryQuerySchema,
} from '@daoyou/contracts/inventory';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import {
  mutateInventory,
  readInventory,
} from '@server/inventory/application/InventoryService.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService.js';
import type { z } from 'zod';

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  async read(owner: string, query: z.infer<typeof InventoryQuerySchema>) {
    if (query.location === 'bag' && query.kind === 'all' && !query.search) {
      return readResourceWithMeta(
        { kind: 'cultivator', id: owner },
        'inventory.bag',
        (tx) => readInventory(owner, query, tx),
        this.database,
      );
    }
    return {
      success: true,
      data: await readInventory(owner, query, this.database),
    };
  }

  async mutate(owner: string, action: z.infer<typeof InventoryActionSchema>) {
    return {
      success: true,
      ...(await mutateInventory(owner, action, this.database)),
    };
  }
}
