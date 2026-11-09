import { Module } from '@nestjs/common';
import { LlmModule } from '@server/llm/llm.module.js';
import { ForgingController } from './forging.controller.js';
import { ForgingService } from './forging.service.js';

@Module({
  imports: [LlmModule],
  controllers: [ForgingController],
  providers: [ForgingService],
})
export class ForgingModule {}
