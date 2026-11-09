import { Module } from '@nestjs/common';
import { LlmModule } from '@server/llm/llm.module.js';
import {
  GenerateCharacterController,
  GenerateFatesController,
  SaveCharacterController,
} from './genesis.controller.js';
import { GenesisService } from './genesis.service.js';
@Module({
  imports: [LlmModule],
  controllers: [
    GenerateCharacterController,
    GenerateFatesController,
    SaveCharacterController,
  ],
  providers: [GenesisService],
})
export class GenesisModule {}
