import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { RedisModule } from '@server/redis/redis.module.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
