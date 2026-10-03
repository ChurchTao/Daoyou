import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller.js';
import { AuctionService } from './auction.service.js';

@Module({ controllers: [AuctionController], providers: [AuctionService] })
export class AuctionModule {}
