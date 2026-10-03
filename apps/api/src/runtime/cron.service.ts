import { Inject, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BACKGROUND_SCHEDULES } from '@server/runtime/jobs/schedules.js';
import { publishScheduledBackgroundCommand } from '@server/lib/mq/backgroundCommandPublisher.js';
import { CronJob } from 'cron';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class CronService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(SchedulerRegistry) private readonly scheduler: SchedulerRegistry,
  ) {}

  start(): void {
    if (this.config.get('NODE_ENV') !== 'production') return;
    for (const { type, expression } of BACKGROUND_SCHEDULES) {
      const job = CronJob.from({
        cronTime: expression,
        onTick: async () => {
          try {
            await publishScheduledBackgroundCommand(type);
          } catch (error) {
            console.error(`[cron] publish ${type} failed`, error);
          }
        },
        start: false,
        timeZone: 'UTC',
        waitForCompletion: true,
      });
      this.scheduler.addCronJob(type, job);
      job.start();
    }
  }

  async stop(): Promise<void> {
    await Promise.all(
      [...this.scheduler.getCronJobs().values()].map((job) => job.stop()),
    );
  }
}
