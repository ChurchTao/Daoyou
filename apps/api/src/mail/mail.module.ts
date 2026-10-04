import { Module } from '@nestjs/common';
import { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import { CultivatorModule } from '@server/cultivator/cultivator.module.js';
import { DatabaseModule } from '@server/database/database.module.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import type { withRedisLock } from '@server/lib/redis/lock.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { ResourceEngine } from '@server/player/application/state/ResourceEngine.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import { REDIS_LOCK, RedisModule } from '@server/redis/redis.module.js';
import { PlayerMailApplicationService } from './application/PlayerMailApplicationService.js';
import { MailDeliveryService } from './mail-delivery.service.js';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [DatabaseModule, PlayerStateModule, CultivatorModule, RedisModule],
  controllers: [MailController],
  providers: [
    MailService,
    MailDeliveryService,
    {
      provide: PlayerMailApplicationService,
      useFactory: (
        database: DbClient,
        commands: PlayerCommandExecutor,
        resources: ResourceEngine,
        facts: CultivatorQueriesService,
        delivery: MailDeliveryService,
        lock: typeof withRedisLock,
      ) =>
        new PlayerMailApplicationService(
          database,
          commands,
          resources,
          facts,
          delivery,
          lock,
        ),
      inject: [
        DRIZZLE_DATABASE,
        PlayerCommandExecutor,
        ResourceEngine,
        CultivatorQueriesService,
        MailDeliveryService,
        REDIS_LOCK,
      ],
    },
  ],
  exports: [MailDeliveryService],
})
export class MailModule {}
