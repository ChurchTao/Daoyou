import { Module } from '@nestjs/common';
import { LlmModule } from '@server/llm/llm.module.js';
import { SpiritFieldController } from './spirit-field.controller.js';
import { SpiritFieldService } from './spirit-field.service.js';

@Module({
  imports: [LlmModule],
  controllers: [SpiritFieldController],
  providers: [SpiritFieldService],
})
export class SpiritFieldModule {}
