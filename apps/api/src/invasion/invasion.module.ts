import { Module } from '@nestjs/common';
import { InvasionController } from './invasion.controller.js';
import { InvasionService } from './invasion.service.js';

@Module({
  controllers: [InvasionController],
  providers: [InvasionService],
  exports: [InvasionService],
})
export class InvasionModule {}
