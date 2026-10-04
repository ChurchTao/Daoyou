import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import type { withRedisLock } from '@server/lib/redis/lock.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { ResourceEngine } from '@server/player/application/state/ResourceEngine.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import {
  REDIS_CLIENT,
  REDIS_LOCK,
  RedisModule,
} from '@server/redis/redis.module.js';
import type { Redis } from 'ioredis';
import { DungeonApplicationService } from './application/DungeonApplicationService.js';
import { DungeonFlowService } from './application/flow/DungeonFlowService.js';
import { generateDungeonRound } from './application/flow/DungeonRoundGenerator.js';
import { DungeonRunStore } from './application/flow/DungeonRunStore.js';
import { generateDungeonEnding } from './application/flow/DungeonSettlementGenerator.js';
import { DungeonBattleController } from './dungeon-battle.controller.js';
import { DungeonController } from './dungeon.controller.js';
import { DungeonService } from './dungeon.service.js';

@Module({
  imports: [DatabaseModule, PlayerStateModule, RedisModule],
  controllers: [DungeonController, DungeonBattleController],
  providers: [
    {
      provide: DungeonRunStore,
      useFactory: (database: DbClient, cache: Redis) =>
        new DungeonRunStore(database, cache),
      inject: [DRIZZLE_DATABASE, REDIS_CLIENT],
    },
    {
      provide: DungeonFlowService,
      useFactory: (
        database: DbClient,
        runs: DungeonRunStore,
        resources: ResourceEngine,
        lock: typeof withRedisLock,
      ) =>
        new DungeonFlowService(
          generateDungeonRound,
          generateDungeonEnding,
          database,
          runs,
          resources,
          lock,
        ),
      inject: [DRIZZLE_DATABASE, DungeonRunStore, ResourceEngine, REDIS_LOCK],
    },
    {
      provide: DungeonApplicationService,
      useFactory: (
        flow: DungeonFlowService,
        commands: PlayerCommandExecutor,
        cache: Redis,
        lock: typeof withRedisLock,
      ) => new DungeonApplicationService(flow, commands, cache, lock),
      inject: [
        DungeonFlowService,
        PlayerCommandExecutor,
        REDIS_CLIENT,
        REDIS_LOCK,
      ],
    },
    DungeonService,
  ],
})
export class DungeonModule {}
