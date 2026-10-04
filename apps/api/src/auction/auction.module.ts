import { Module } from '@nestjs/common';
import { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import { CultivatorModule } from '@server/cultivator/cultivator.module.js';
import { DatabaseModule } from '@server/database/database.module.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import type { withRedisLock } from '@server/lib/redis/lock.js';
import { MailDeliveryService } from '@server/mail/mail-delivery.service.js';
import { MailModule } from '@server/mail/mail.module.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import {
  REDIS_CLIENT,
  REDIS_LOCK,
  RedisModule,
} from '@server/redis/redis.module.js';
import type { Redis } from 'ioredis';
import { AuctionApplicationService } from './application/AuctionApplicationService.js';
import { AuctionOperations } from './application/AuctionService.js';
import { AuctionController } from './auction.controller.js';
import { AuctionService } from './auction.service.js';

@Module({
  imports: [
    DatabaseModule,
    CultivatorModule,
    PlayerStateModule,
    MailModule,
    RedisModule,
  ],
  controllers: [AuctionController],
  providers: [
    {
      provide: AuctionOperations,
      useFactory: (
        database: DbClient,
        cache: Redis,
        mail: MailDeliveryService,
      ) => new AuctionOperations(database, cache, mail),
      inject: [DRIZZLE_DATABASE, REDIS_CLIENT, MailDeliveryService],
    },
    {
      provide: AuctionApplicationService,
      useFactory: (
        operations: AuctionOperations,
        commands: PlayerCommandExecutor,
        facts: CultivatorQueriesService,
        lock: typeof withRedisLock,
      ) => new AuctionApplicationService(operations, commands, facts, lock),
      inject: [
        AuctionOperations,
        PlayerCommandExecutor,
        CultivatorQueriesService,
        REDIS_LOCK,
      ],
    },
    AuctionService,
  ],
  exports: [AuctionOperations],
})
export class AuctionModule {}
