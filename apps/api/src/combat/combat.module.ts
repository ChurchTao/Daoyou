import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { CombatV6RuntimeStore } from './application/CombatV6RuntimeStore.js';
import { CombatV6TrainingSessionService } from './application/CombatV6TrainingSessionService.js';
import { AutoStrategyController } from './auto-strategy.controller.js';
import { AutoStrategyService } from './auto-strategy.service.js';
import { BreakthroughController } from './breakthrough.controller.js';
import { BreakthroughService } from './breakthrough.service.js';
import { CombatActivityController } from './combat-activity.controller.js';
import { CombatActivityService } from './combat-activity.service.js';
import {
  ReplaysController,
  SharedReplaysController,
} from './replays.controller.js';
import { ReplaysService } from './replays.service.js';
import { SectTaskBattleController } from './sect-task.controller.js';
import { SectTaskBattleService } from './sect-task.service.js';
import { TraceParamsPipe, TrainingController } from './training.controller.js';
import { TrainingService } from './training.service.js';
import { WildController } from './wild.controller.js';
import { WildService } from './wild.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    CombatActivityController,
    ReplaysController,
    SharedReplaysController,
    TrainingController,
    WildController,
    AutoStrategyController,
    BreakthroughController,
    SectTaskBattleController,
  ],
  providers: [
    {
      provide: CombatV6RuntimeStore,
      useFactory: () => new CombatV6RuntimeStore(),
    },
    {
      provide: CombatV6TrainingSessionService,
      useFactory: (store: CombatV6RuntimeStore, database: DbClient) =>
        new CombatV6TrainingSessionService(store, database),
      inject: [CombatV6RuntimeStore, DRIZZLE_DATABASE],
    },
    TraceParamsPipe,
    CombatActivityService,
    ReplaysService,
    TrainingService,
    WildService,
    AutoStrategyService,
    BreakthroughService,
    SectTaskBattleService,
  ],
  exports: [CombatV6TrainingSessionService],
})
export class CombatModule {}
