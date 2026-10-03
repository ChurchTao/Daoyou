import { Module } from '@nestjs/common';
import { SponsorshipController } from './sponsorship.controller.js';
import { SponsorshipService } from './sponsorship.service.js';
@Module({
  controllers: [SponsorshipController],
  providers: [SponsorshipService],
})
export class SponsorshipModule {}
