import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { RankingsController } from './rankings.controller.js';
import { RankingsService } from './rankings.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [RankingsController],
  providers: [RankingsService],
})
export class RankingsModule {}
