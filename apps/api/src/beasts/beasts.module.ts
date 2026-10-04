import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { BeastsController } from './beasts.controller.js';
import { BeastsService } from './beasts.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [BeastsController],
  providers: [BeastsService],
})
export class BeastsModule {}
