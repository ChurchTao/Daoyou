import { Module } from '@nestjs/common';
import { BaixiaoModule } from '@server/baixiao/baixiao.module.js';
import { DatabaseModule } from '@server/database/database.module.js';
import { HomeRumorsService } from './application/HomeRumorsService.js';
import { HomeRumorsController } from './home-rumors.controller.js';
import { JournalController } from './journal.controller.js';
import { PlayerController } from './player.controller.js';
import { PlayerService } from './player.service.js';

@Module({
  imports: [DatabaseModule, BaixiaoModule],
  controllers: [PlayerController, JournalController, HomeRumorsController],
  providers: [PlayerService, HomeRumorsService],
})
export class PlayerModule {}
