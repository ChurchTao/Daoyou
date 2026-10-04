import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import { InventoryRecycleService } from './inventory-recycle.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [DatabaseModule, PlayerStateModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRecycleService],
  exports: [InventoryRecycleService],
})
export class InventoryModule {}
