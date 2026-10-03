import { Module } from '@nestjs/common';
import { HuntsController } from './hunts.controller.js';
import { HuntsService } from './hunts.service.js';

@Module({ controllers: [HuntsController], providers: [HuntsService] })
export class HuntsModule {}
