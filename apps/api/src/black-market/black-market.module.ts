import { Module } from '@nestjs/common';
import {
  BlackMarketConversationService,
  blackMarketConversationService,
} from '@server/black-market/application/BlackMarketConversationService.js';
import {
  BlackMarketController,
  BlackMarketStreamController,
} from './black-market.controller.js';
import { BlackMarketService } from './black-market.service.js';

@Module({
  controllers: [BlackMarketController, BlackMarketStreamController],
  providers: [
    {
      provide: BlackMarketConversationService,
      useValue: blackMarketConversationService,
    },
    BlackMarketService,
  ],
})
export class BlackMarketModule {}
