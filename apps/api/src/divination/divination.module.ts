import { Module } from '@nestjs/common';
import {
  DivinationController,
  DivinationStreamController,
} from './divination.controller.js';
import { DivinationService } from './divination.service.js';
import { DivineFortuneController } from './divine-fortune.controller.js';
import { DivineFortuneService } from './divine-fortune.service.js';

@Module({
  controllers: [
    DivinationController,
    DivinationStreamController,
    DivineFortuneController,
  ],
  providers: [DivinationService, DivineFortuneService],
})
export class DivinationModule {}
