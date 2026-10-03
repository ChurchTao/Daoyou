import { Module } from '@nestjs/common';
import { EnlightenmentController } from './enlightenment.controller.js';
import { EnlightenmentService } from './enlightenment.service.js';

@Module({
  controllers: [EnlightenmentController],
  providers: [EnlightenmentService],
})
export class EnlightenmentModule {}
