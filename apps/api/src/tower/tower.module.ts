import { Module } from '@nestjs/common';
import { TowerController } from './tower.controller.js';
import { TowerService } from './tower.service.js';

@Module({ controllers: [TowerController], providers: [TowerService] })
export class TowerModule {}
