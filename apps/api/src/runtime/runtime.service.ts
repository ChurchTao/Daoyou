import {
  Inject,
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CombatV6TrainingSessionService } from '@server/combat/application/CombatV6TrainingSessionService.js';
import { closeRedisConnection } from '@server/lib/redis/index.js';
import {
  registerMessageInfrastructure,
  shutdownMessageInfrastructure,
} from '@server/runtime/messaging/domainEventRegistry.js';
import type { Server } from 'node:http';
import { DatabaseService } from '../database/database.service.js';
import { RequestWorkService } from '../http/request-work.service.js';
import { CronService } from './cron.service.js';
import { InternalCronService } from './internal-cron.service.js';
import { createBackgroundCommandHandlers } from './messaging/backgroundCommandConsumer.js';

@Injectable()
export class RuntimeService
  implements
    OnApplicationBootstrap,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  private drainTimer?: ReturnType<typeof setTimeout>;

  constructor(
    @Inject(CombatV6TrainingSessionService)
    private readonly training: CombatV6TrainingSessionService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InternalCronService) private readonly jobs: InternalCronService,
    @Inject(CronService) private readonly cron: CronService,
    @Inject(HttpAdapterHost) private readonly http: HttpAdapterHost,
    @Inject(RequestWorkService) private readonly work: RequestWorkService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await registerMessageInfrastructure(
      this.training,
      createBackgroundCommandHandlers(this.jobs),
    );
    this.cron.start();
  }

  async beforeApplicationShutdown(): Promise<void> {
    console.info('[runtime] stopping scheduled work; draining HTTP requests');
    await this.cron.stop();
    this.drainTimer = setTimeout(() => {
      console.warn(
        '[runtime] HTTP drain exceeded 30s; closing remaining connections',
      );
      const server: Server = this.http.httpAdapter.getHttpServer();
      server.closeAllConnections();
    }, 30_000);
    this.drainTimer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearTimeout(this.drainTimer);
    await this.work.drain();
    console.info(
      '[runtime] request handlers drained; stopping message infrastructure',
    );
    await shutdownMessageInfrastructure();
    console.info('[runtime] message infrastructure stopped');
    console.info('[runtime] closing database and Redis connections');
    const results = await Promise.allSettled([
      this.database.close(),
      closeRedisConnection(),
    ]);
    const errors = results.filter((result) => result.status === 'rejected');
    if (errors.length)
      throw new AggregateError(
        errors.map((result) => result.reason),
        'Runtime cleanup failed',
      );
    console.info('[runtime] shutdown complete');
  }
}
