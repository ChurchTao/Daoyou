import { Module } from '@nestjs/common';
import { LlmModule } from '@server/llm/llm.module.js';
import {
  DivinationController,
  DivinationStreamController,
} from './divination.controller.js';
import { DivinationService } from './divination.service.js';

@Module({
  imports: [LlmModule],
  controllers: [DivinationController, DivinationStreamController],
  providers: [DivinationService],
})
export class DivinationModule {}
