import { Module } from '@nestjs/common';
import { SpiritFieldController } from './spirit-field.controller.js';
import { SpiritFieldService } from './spirit-field.service.js';

@Module({
  controllers: [SpiritFieldController],
  providers: [SpiritFieldService],
})
export class SpiritFieldModule {}
