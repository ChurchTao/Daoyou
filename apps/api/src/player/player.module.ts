import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { JournalController } from './journal.controller.js';
import { PlayerController } from './player.controller.js';
import { PlayerService } from './player.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PlayerController, JournalController],
  providers: [PlayerService],
})
export class PlayerModule {}
