import { Module } from '@nestjs/common';
import { ForgingController } from './forging.controller.js';
import { ForgingService } from './forging.service.js';

@Module({ controllers: [ForgingController], providers: [ForgingService] })
export class ForgingModule {}
