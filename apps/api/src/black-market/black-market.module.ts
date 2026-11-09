import { Module } from '@nestjs/common';
import { BlackMarketConversationService } from '@server/black-market/application/BlackMarketConversationService.js';
import { BlackMarketObservationService } from '@server/black-market/application/BlackMarketObservationService.js';
import { BlackMarketPerceptionService } from '@server/black-market/application/BlackMarketPerceptionService.js';
import { LlmModule } from '@server/llm/llm.module.js';
import {
  BlackMarketController,
  BlackMarketStreamController,
} from './black-market.controller.js';
import { BlackMarketService } from './black-market.service.js';

@Module({
  imports: [LlmModule],
  controllers: [BlackMarketController, BlackMarketStreamController],
  providers: [
    BlackMarketConversationService,
    BlackMarketObservationService,
    BlackMarketPerceptionService,
    BlackMarketService,
  ],
})
export class BlackMarketModule {}
