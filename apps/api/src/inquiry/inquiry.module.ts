import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import { InquiryController } from './inquiry.controller.js';
import { InquiryService } from './inquiry.service.js';

@Module({
  imports: [DatabaseModule, PlayerStateModule],
  controllers: [InquiryController],
  providers: [InquiryService],
})
export class InquiryModule {}
