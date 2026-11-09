import { AiService } from '@nestjs/ai';
import { Inject, Injectable } from '@nestjs/common';
import {
  analyzeFormulaMaterials,
  confirmDiscoveryCandidate,
  deleteCultivatorFormula,
  listCultivatorFormulasPage,
} from '@server/alchemy/application/AlchemyFormulaService.js';
import {
  assertAlchemyMaterialVersions,
  readAlchemyMaterials,
} from '@server/alchemy/application/inventory/AlchemyInventory.js';
import type { z } from 'zod';
import type {
  DiscoveryConfirmSchema,
  FormulaAnalyzeSchema,
  FormulaListQuerySchema,
} from './alchemy-input.js';

@Injectable()
export class AlchemyFormulasService {
  constructor(@Inject(AiService) private readonly ai: AiService) {}
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
    owner: string,
    formulaId: string,
    input: z.infer<typeof FormulaAnalyzeSchema>,
  ) {
    await assertAlchemyMaterialVersions(
      owner,
      input.materialIds,
      input.materialVersions,
    );
    return {
      success: true,
      data: await analyzeFormulaMaterials(
        this.ai,
        owner,
        formulaId,
        input.materialIds,
        input.materialQuantities,
      ),
    };
  }

  async confirm(owner: string, input: z.infer<typeof DiscoveryConfirmSchema>) {
    return {
      success: true,
      data: await confirmDiscoveryCandidate(owner, input.token, input.accept),
    };
  }
}
