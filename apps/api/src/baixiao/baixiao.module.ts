import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { BaixiaoDuelService } from './application/BaixiaoDuelService.js';
import { BaixiaoMeetService } from './application/BaixiaoMeetService.js';
import { BaixiaoQuestionBank } from './application/BaixiaoQuestionBank.js';
import { BaixiaoStandings } from './application/BaixiaoStandings.js';
import { BaixiaoAdminController } from './baixiao-admin.controller.js';
import { BaixiaoDuelController } from './baixiao-duel.controller.js';
import { BaixiaoController } from './baixiao.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    BaixiaoController,
    BaixiaoAdminController,
    BaixiaoDuelController,
  ],
  providers: [
    BaixiaoMeetService,
    BaixiaoQuestionBank,
    BaixiaoStandings,
    BaixiaoDuelService,
  ],
  exports: [BaixiaoStandings, BaixiaoQuestionBank],
})
export class BaixiaoModule {}
