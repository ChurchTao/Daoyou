import { Module } from '@nestjs/common';
import { ReputationShopController } from './reputation-shop.controller.js';
import { ReputationShopService } from './reputation-shop.service.js';

@Module({
  controllers: [ReputationShopController],
  providers: [ReputationShopService],
})
export class ReputationShopModule {}
