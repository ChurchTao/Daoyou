import { Module } from '@nestjs/common';
import { AuthModule } from '@server/auth/auth.module.js';
import { DatabaseModule } from '@server/database/database.module.js';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsService } from './achievements.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
