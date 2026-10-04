import { Module } from '@nestjs/common';
import {
  BlackMarketConversationService,
  blackMarketConversationService,
} from '@server/black-market/application/BlackMarketConversationService.js';
import { BlackMarketController } from './black-market.controller.js';
import { BlackMarketService } from './black-market.service.js';

@Module({
  controllers: [BlackMarketController],
  providers: [
    {
      provide: BlackMarketConversationService,
      useValue: blackMarketConversationService,
    },
    BlackMarketService,
  ],
})
export class BlackMarketModule {}
