import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { LlmModule } from '@server/llm/llm.module.js';
import { AlchemyContestAdminController } from './alchemy-contest-admin.controller.js';
import { AlchemyContestController } from './alchemy-contest.controller.js';
import { AlchemyContestPreparation } from './application/AlchemyContestPreparation.js';
import { AlchemyContestService } from './application/AlchemyContestService.js';
import { AlchemyContestSettlement } from './application/AlchemyContestSettlement.js';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [AlchemyContestController, AlchemyContestAdminController],
  providers: [
    AlchemyContestService,
    AlchemyContestPreparation,
    AlchemyContestSettlement,
  ],
  exports: [AlchemyContestPreparation, AlchemyContestSettlement],
})
export class AlchemyContestModule {}
