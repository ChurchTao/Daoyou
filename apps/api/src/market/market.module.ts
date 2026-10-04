import { Module } from '@nestjs/common';
import { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import { CultivatorModule } from '@server/cultivator/cultivator.module.js';
import { DatabaseModule } from '@server/database/database.module.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { InventoryModule } from '@server/inventory/inventory.module.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import { MarketPurchaseService } from './application/MarketApplicationService.js';
import { MarketController } from './market.controller.js';
import { MarketService } from './market.service.js';

@Module({
  imports: [
    DatabaseModule,
    CultivatorModule,
    InventoryModule,
    PlayerStateModule,
  ],
  controllers: [MarketController],
  providers: [
    {
      provide: MarketPurchaseService,
      useFactory: (
        facts: CultivatorQueriesService,
        commands: PlayerCommandExecutor,
        database: DbClient,
      ) => new MarketPurchaseService(facts, commands, database),
      inject: [
        CultivatorQueriesService,
        PlayerCommandExecutor,
        DRIZZLE_DATABASE,
      ],
    },
    MarketService,
  ],
})
export class MarketModule {}
