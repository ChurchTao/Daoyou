import type {
  AlchemyFormula,
  AlchemyRecipePlan,
  FormulaFitBand,
  FormulaMaterialJudgment,
} from '@daoyou/game-domain/consumables';
import {
  ALCHEMY_FOCUS_MODE_VALUES,
  FORMULA_FIT_BAND_VALUES,
  FORMULA_MATERIAL_VERDICT_VALUES,
} from '@daoyou/game-domain/consumables';
import {
  GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES,
  getAlchemyPropertyLabel,
  normalizeWeightedAlchemyProperties,
} from '@daoyou/game-rules/alchemy';
import type { AiService } from '@nestjs/ai';
import type { PreparedAlchemyMaterial } from '@server/alchemy/application/AlchemyRecipeRules.js';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { aiDeadlineSignal } from '@server/llm/call-options.js';
import {
  stableCompactStringify,
  truncateText,
} from '@server/utils/llmPayload.js';
import { z } from 'zod';

const weightedAlchemyPropertySchema = z.object({
  key: z.enum(GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES),
  weight: z.number().min(0).max(1),
});

const materialAnalysisSchema = z.object({
  materialRef: z.string().min(1),
  properties: z.array(weightedAlchemyPropertySchema).min(1).max(3),
  verdict: z.enum(FORMULA_MATERIAL_VERDICT_VALUES),
  reason: z.string().trim().min(1).max(40),
});

const formulaAnalysisSchema = z
  .object({
    materials: z.array(materialAnalysisSchema).min(1),
    focusMode: z.enum(ALCHEMY_FOCUS_MODE_VALUES),
    fitBand: z.enum(FORMULA_FIT_BAND_VALUES),
    conclusion: z.string().trim().min(1).max(80),
  })
  .superRefine((analysis, context) => {
    const verdicts = analysis.materials.map((material) => material.verdict);
    const hasCore = verdicts.includes('core');
    const hasConflict = verdicts.includes('conflict');
    const claimsCompleteAlignment = [
      analysis.conclusion,
      ...analysis.materials.map((material) => material.reason),
    ].some((text) => /完美契合|完全契合|高度契合/.test(text));

    if (analysis.fitBand === 'aligned' && (!hasCore || hasConflict)) {
      context.addIssue({
        code: 'custom',
        message: 'aligned 炉况必须包含主材且不能包含冲突材料',
      });
    }
    if (analysis.fitBand === 'poor' && !hasConflict) {
      context.addIssue({
        code: 'custom',
        message: 'poor 炉况必须指出至少一味冲突材料',
      });
    }
    if (analysis.fitBand !== 'aligned' && claimsCompleteAlignment) {
      context.addIssue({
        code: 'custom',
        message: '非 aligned 炉况不得声称材料或整炉完全契合',
      });
    }
  });

function buildPropertyGuide(): string {
  return GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES.map(
    (key) => `- ${key}: ${getAlchemyPropertyLabel(key)}`,
  ).join('\n');
}

function normalizeAnalysis(analysis: z.infer<typeof formulaAnalysisSchema>) {
  return {
    ...analysis,
    materials: analysis.materials.map((material) => ({
      ...material,
      properties: normalizeWeightedAlchemyProperties(material.properties).slice(
        0,
        3,
      ),
    })),
  };
}

export class AlchemyFormulaAnalyzer {
  constructor(
    private readonly ai: AiService,
    private readonly options: {
      timeoutMs?: number;
    } = {},
  ) {}

  async analyze(input: {
    formula: AlchemyFormula;
    materials: PreparedAlchemyMaterial[];
  }): Promise<{
    plan: AlchemyRecipePlan;
    fitBand: FormulaFitBand;
    conclusion: string;
    materialJudgments: FormulaMaterialJudgment[];
  }> {
    const payloadJson = stableCompactStringify({
      formula: {
        name: input.formula.name,
        description: truncateText(input.formula.description, 96),
        family: input.formula.family,
        masteryLevel: input.formula.mastery.level,
        pattern: {
          targetPropertyVector: input.formula.pattern.targetPropertyVector,
          dominantElement: input.formula.pattern.dominantElement,
          minQuality: input.formula.pattern.minQuality,
          slotCount: input.formula.pattern.slotCount,
        },
      },
      materials: input.materials.map((material) => ({
        materialRef: material.materialRef,
        materialName: material.name,
        type: material.type,
        rank: material.rank,
        element: material.element ?? null,
        dose: material.dose,
        description: truncateText(material.description, 64),
      })),
    });

    const { system, user } = renderPrompt('alchemy-formula-analysis', {
      propertyGuide: buildPropertyGuide(),
      payloadJson,
    });

    const response = await this.ai.generateObject({
      model: 'alibaba.fast',
      abortSignal: aiDeadlineSignal(this.options.timeoutMs ?? 20_000),
      instructions: system,
      prompt: user,
      schema: formulaAnalysisSchema,
      schemaName: 'AlchemyFormulaAnalysis',
      label: 'alchemy-formula-analysis',
    });

    const normalized = normalizeAnalysis(response.object);
    const materialMap = new Map(
      input.materials.map((material) => [material.materialRef, material]),
    );

    if (normalized.materials.length !== input.materials.length) {
      throw new Error(
        'formula analyzer returned mismatched material analysis count',
      );
    }

    const seenRefs = new Set<string>();
    const materialVectors: AlchemyRecipePlan['materialVectors'] = [];
    const materialJudgments: FormulaMaterialJudgment[] = [];
    for (const analyzed of normalized.materials) {
      if (seenRefs.has(analyzed.materialRef)) {
        throw new Error(
          `formula analyzer returned duplicate materialRef: ${analyzed.materialRef}`,
        );
      }
      seenRefs.add(analyzed.materialRef);

      const material = materialMap.get(analyzed.materialRef);
      if (!material) {
        throw new Error(
          `formula analyzer returned unknown material ref: ${analyzed.materialRef}`,
        );
      }
      materialVectors.push({
        materialRef: analyzed.materialRef,
        materialName: material.name,
        properties: analyzed.properties,
      });
      materialJudgments.push({
        materialId: material.id,
        materialName: material.name,
        verdict: analyzed.verdict,
        reason: analyzed.reason.trim(),
      });
    }

    return {
      plan: {
        materialVectors,
        intentVector: [],
        focusMode: normalized.focusMode,
        requestedElementBias: input.formula.pattern.dominantElement,
      },
      fitBand: normalized.fitBand,
      conclusion: normalized.conclusion.trim(),
      materialJudgments,
    };
  }
}
