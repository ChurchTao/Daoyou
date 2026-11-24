import { LlmModule } from '@server/llm/llm.module.js';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlchemyContestModule } from '../alchemy-contest/alchemy-contest.module.js';
import { AuctionModule } from '../auction/auction.module.js';
import { CombatModule } from '../combat/combat.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CronService } from './cron.service.js';
import { InternalCronController } from './internal-cron.controller.js';
import { InternalCronGuard } from './internal-cron.guard.js';
import { InternalCronService } from './internal-cron.service.js';
import { RuntimeService } from './runtime.service.js';

@Module({
  imports: [LlmModule,
    DatabaseModule,
    CombatModule,
    AuctionModule,
    AlchemyContestModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [InternalCronController],
  providers: [
    RuntimeService,
    CronService,
    InternalCronGuard,
    InternalCronService,
  ],
})
export class RuntimeModule {}
