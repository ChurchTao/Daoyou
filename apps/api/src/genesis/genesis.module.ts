import { Module } from '@nestjs/common';
import {
  GenerateCharacterController,
  GenerateFatesController,
  SaveCharacterController,
} from './genesis.controller.js';
import { GenesisService } from './genesis.service.js';
@Module({
  controllers: [
    GenerateCharacterController,
    GenerateFatesController,
    SaveCharacterController,
  ],
  providers: [GenesisService],
})
export class GenesisModule {}
