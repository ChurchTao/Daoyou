import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { DungeonFlowService } from './application/flow/DungeonFlowService.js';
import { generateDungeonRound } from './application/flow/DungeonRoundGenerator.js';
import { DungeonBattleController } from './dungeon-battle.controller.js';
import { DungeonController } from './dungeon.controller.js';
import { DungeonService } from './dungeon.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [DungeonController, DungeonBattleController],
  providers: [
    {
      provide: DungeonFlowService,
      useFactory: () => new DungeonFlowService(generateDungeonRound),
    },
    DungeonService,
  ],
})
export class DungeonModule {}
