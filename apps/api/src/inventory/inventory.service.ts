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
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService.js';
import type { z } from 'zod';
import { openMysteryBag } from './application/MysteryBagService.js';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(PlayerCommandExecutor)
    private readonly commands: PlayerCommandExecutor,
  ) {}
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

  async mutate(
    actor: ActiveCultivatorRef,
    action: z.infer<typeof InventoryActionSchema>,
  ) {
    if (action.action === 'open_mystery_bag') {
      const { result, state } = await openMysteryBag(
        actor,
        action,
        this.commands,
      );
      return { success: true, data: result, state };
    }
    const owner = actor.cultivatorId;
    return {
      success: true,
      ...(await mutateInventory(owner, action, this.database)),
    };
  }
}
