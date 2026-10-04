import type { RecycleSelection } from '@daoyou/contracts/recycle';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  confirmBagRecycle,
  previewBagRecycle,
} from './application/BagRecycleService.js';

/** Public inventory recycling use cases; quotations and writes keep their owner. */
@Injectable()
export class InventoryRecycleService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(PlayerCommandExecutor)
    private readonly commands: PlayerCommandExecutor,
  ) {}

  preview(owner: string, selection: RecycleSelection[]) {
    return previewBagRecycle(owner, selection, this.database);
  }

  confirm(actor: { userId: string; cultivatorId: string }, quoteId: string) {
    return confirmBagRecycle(actor, quoteId, this.commands);
  }
}
