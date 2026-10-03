import { Module } from '@nestjs/common';
import { AlchemyFormulasController } from './alchemy-formulas.controller.js';
import { AlchemyFormulasService } from './alchemy-formulas.service.js';
import { CraftController } from './craft.controller.js';
import { CraftService } from './craft.service.js';

@Module({
  controllers: [AlchemyFormulasController, CraftController],
  providers: [AlchemyFormulasService, CraftService],
})
export class AlchemyModule {}
