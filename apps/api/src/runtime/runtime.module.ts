import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuctionModule } from '../auction/auction.module.js';
import { CombatModule } from '../combat/combat.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RequestWorkService } from '../http/request-work.service.js';
import { CronService } from './cron.service.js';
import { InternalCronController } from './internal-cron.controller.js';
import { InternalCronGuard } from './internal-cron.guard.js';
import { InternalCronService } from './internal-cron.service.js';
import { RuntimeService } from './runtime.service.js';

@Module({
  imports: [
    DatabaseModule,
    CombatModule,
    AuctionModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [InternalCronController],
  providers: [
    RuntimeService,
    RequestWorkService,
    CronService,
    InternalCronGuard,
    InternalCronService,
  ],
  exports: [RequestWorkService],
})
export class RuntimeModule {}
