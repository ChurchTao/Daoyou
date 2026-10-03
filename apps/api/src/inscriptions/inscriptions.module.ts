import { Module } from '@nestjs/common';
import { InscriptionsController } from './inscriptions.controller.js';
import { InscriptionsService } from './inscriptions.service.js';

@Module({
  controllers: [InscriptionsController],
  providers: [InscriptionsService],
})
export class InscriptionsModule {}
