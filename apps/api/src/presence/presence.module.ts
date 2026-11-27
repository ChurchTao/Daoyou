import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { RedisModule } from '@server/redis/redis.module.js';
import { PresenceHistoryService } from './presence-history.service.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [PresenceService, PresenceHistoryService],
  exports: [PresenceService, PresenceHistoryService],
})
export class PresenceModule {}
