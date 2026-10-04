import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { getMessageInfrastructureHealthStatus } from '@server/runtime/messaging/domainEventRegistry.js';
import { getNatsHealthStatus } from '@server/lib/nats/index.js';
import { getRedisHealthStatus } from '@server/lib/redis/index.js';
import { Access } from '../auth/access.js';
import { DatabaseService } from '../database/database.service.js';

@Controller('api/health-check')
@Access('public')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  async health() {
    const [database, redis, nats] = await Promise.all([
      this.database.healthStatus(),
      getRedisHealthStatus(),
      getNatsHealthStatus(),
    ]);
    const messaging = getMessageInfrastructureHealthStatus();
    if (
      database === 'down' ||
      redis !== 'up' ||
      nats === 'down' ||
      messaging === 'down'
    ) {
      throw new HttpException(
        {
          success: false,
          error:
            database === 'down'
              ? 'Database unavailable'
              : redis !== 'up'
                ? 'Redis unavailable'
                : nats === 'down'
                  ? 'NATS unavailable'
                  : 'Message infrastructure unavailable',
          database,
          redis,
          nats,
          messaging,
        },
        503,
      );
    }
    return { success: true, message: 'OK', database, redis, nats, messaging };
  }
}
