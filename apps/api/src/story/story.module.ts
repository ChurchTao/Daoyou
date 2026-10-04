import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { StoryController } from './story.controller.js';
import { StoryService } from './story.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [StoryController],
  providers: [StoryService],
})
export class StoryModule {}
