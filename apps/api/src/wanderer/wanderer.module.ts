import { Module } from '@nestjs/common';
import { WandererController } from './wanderer.controller.js';
import { WandererService } from './wanderer.service.js';

@Module({
  controllers: [WandererController],
  providers: [WandererService],
})
export class WandererModule {}
