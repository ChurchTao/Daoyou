import { AiModels, AiService } from '@nestjs/ai';
import { Inject, Injectable } from '@nestjs/common';
import {
  analyzeFormulaMaterials,
  confirmDiscoveryCandidate,
  deleteCultivatorFormula,
  listCultivatorFormulasPage,
} from '@server/alchemy/application/AlchemyFormulaService.js';
import { readAlchemyMaterials } from '@server/alchemy/application/inventory/AlchemyInventory.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { z } from 'zod';
import type {
  DiscoveryConfirmSchema,
  FormulaAnalyzeSchema,
  FormulaListQuerySchema,
} from './alchemy-input.js';

@Injectable()
export class AlchemyFormulasService {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AiModels) private readonly models: AiModels,
  ) {}
  async materials(owner: string) {
    return { success: true, data: await readAlchemyMaterials(owner) };
  }

  async list(owner: string, query: z.infer<typeof FormulaListQuerySchema>) {
    const result = await listCultivatorFormulasPage(owner, query);
    return {
      success: true,
      data: { formulas: result.formulas, pagination: result.pagination },
    };
  }

  async remove(owner: string, formulaId: string) {
    await deleteCultivatorFormula(owner, formulaId);
    return { success: true, message: '丹方已删除' };
  }

  async analyze(
    actor: ActiveCultivatorRef,
    formulaId: string,
    input: z.infer<typeof FormulaAnalyzeSchema>,
  ) {
    const model = this.models.get('alibaba.fast');
    const modelKey = JSON.stringify([
      typeof model === 'string' ? model : model.provider,
      typeof model === 'string' ? model : model.modelId,
      getRuntimeEnvironment().ALIBABA_BASE_URL ?? '',
    ]);
    return toPlayerStateMutationResponse(
      await analyzeFormulaMaterials(
        this.ai,
        { userId: actor.userId, cultivatorId: actor.cultivatorId },
        formulaId,
        input,
        modelKey,
      ),
    );
  }

  async confirm(owner: string, input: z.infer<typeof DiscoveryConfirmSchema>) {
    return {
      success: true,
      data: await confirmDiscoveryCandidate(owner, input.token, input.accept),
    };
  }
}
