import { Module } from '@nestjs/common';
import { LlmModule } from '@server/llm/llm.module.js';
import { AlchemyFormulasController } from './alchemy-formulas.controller.js';
import { AlchemyFormulasService } from './alchemy-formulas.service.js';
import { CraftController } from './craft.controller.js';
import { CraftService } from './craft.service.js';

@Module({
  imports: [LlmModule],
  controllers: [AlchemyFormulasController, CraftController],
  providers: [AlchemyFormulasService, CraftService],
})
export class AlchemyModule {}
