import { Module } from '@nestjs/common';
import { ManualsController } from './manuals.controller.js';
import { ManualsService } from './manuals.service.js';

@Module({ controllers: [ManualsController], providers: [ManualsService] })
export class ManualsModule {}
