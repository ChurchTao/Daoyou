import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { EnemiesController } from './enemies.controller.js';
import { EnemiesService } from './enemies.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [EnemiesController],
  providers: [EnemiesService],
})
export class EnemiesModule {}
