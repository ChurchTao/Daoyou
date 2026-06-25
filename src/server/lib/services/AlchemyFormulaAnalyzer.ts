import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import {
  GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES,
  getAlchemyPropertyLabel,
  normalizeWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import { mergeAlchemyMaterialPropertyHints } from '@shared/lib/alchemyMaterialHints';
import type {
  AlchemyFormula,
  AlchemyRecipePlan,
  FormulaMaterialJudgment,
} from '@shared/types/consumable';
import {
  ALCHEMY_FOCUS_MODE_VALUES,
  FORMULA_MATERIAL_VERDICT_VALUES,
} from '@shared/types/consumable';
import { z } from 'zod';
import type { PreparedAlchemyMaterial } from './AlchemyRecipeRules';

const weightedAlchemyPropertySchema = z.object({
  key: z.enum(GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES),
  weight: z.number().min(0).max(1),
});

const materialVectorSchema = z.object({
  materialRef: z.string().min(1),
  materialName: z.string().min(1),
  properties: z.array(weightedAlchemyPropertySchema).min(1).max(3),
});

const materialJudgmentSchema = z.object({
  materialRef: z.string().min(1),
  verdict: z.enum(FORMULA_MATERIAL_VERDICT_VALUES),
  reason: z.string().trim().min(1).max(40),
});

const formulaAnalysisSchema = z.object({
  materialVectors: z.array(materialVectorSchema).min(1),
  materialJudgments: z.array(materialJudgmentSchema).min(1),
  focusMode: z.enum(ALCHEMY_FOCUS_MODE_VALUES),
});

function buildPropertyGuide(): string {
  return GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES.map(
    (key) => `- ${key}: ${getAlchemyPropertyLabel(key)}`,
  ).join('\n');
}

function normalizePlan(plan: z.infer<typeof formulaAnalysisSchema>) {
  return {
    ...plan,
    materialVectors: plan.materialVectors.map((vector) => ({
      ...vector,
      properties: normalizeWeightedAlchemyProperties(vector.properties).slice(
        0,
        3,
      ),
    })),
  };
}

export class AlchemyFormulaAnalyzer {
  constructor(
    private readonly options: {
      timeoutMs?: number;
      fastModel?: boolean;
    } = {},
  ) {}

  async analyze(input: {
    formula: AlchemyFormula;
    materials: PreparedAlchemyMaterial[];
  }): Promise<{
    plan: AlchemyRecipePlan;
    materialJudgments: FormulaMaterialJudgment[];
  }> {
    const payloadJson = stableCompactStringify({
      formula: {
        formulaId: input.formula.id,
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
        materialId: material.id,
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

    const response = await this.withTimeout(
      object(
        system,
        user,
        {
          schema: formulaAnalysisSchema,
          schemaName: 'AlchemyFormulaAnalysis',
          sceneId: 'alchemy-formula-analysis',
        },
        this.options.fastModel ?? true,
      ),
    );

    const normalized = normalizePlan(response.object);
    const materialMap = new Map(
      input.materials.map((material) => [material.materialRef, material]),
    );

    if (normalized.materialVectors.length !== input.materials.length) {
      throw new Error(
        'formula analyzer returned mismatched material vector count',
      );
    }
    if (normalized.materialJudgments.length !== input.materials.length) {
      throw new Error(
        'formula analyzer returned mismatched material judgment count',
      );
    }

    const seenVectorRefs = new Set<string>();
    for (const vector of normalized.materialVectors) {
      if (seenVectorRefs.has(vector.materialRef)) {
        throw new Error(
          `formula analyzer returned duplicate materialRef: ${vector.materialRef}`,
        );
      }
      seenVectorRefs.add(vector.materialRef);

      const material = materialMap.get(vector.materialRef);
      if (!material) {
        throw new Error(
          `formula analyzer returned unknown material ref: ${vector.materialRef}`,
        );
      }
      vector.materialName = material.name;
      vector.properties = mergeAlchemyMaterialPropertyHints(vector, material).properties;
    }

    const seenJudgmentRefs = new Set<string>();
    const materialJudgments = normalized.materialJudgments.map((judgment) => {
      if (seenJudgmentRefs.has(judgment.materialRef)) {
        throw new Error(
          `formula analyzer returned duplicate judgment ref: ${judgment.materialRef}`,
        );
      }
      seenJudgmentRefs.add(judgment.materialRef);

      const material = materialMap.get(judgment.materialRef);
      if (!material) {
        throw new Error(
          `formula analyzer returned unknown judgment ref: ${judgment.materialRef}`,
        );
      }

      return {
        materialId: material.id,
        materialName: material.name,
        verdict: judgment.verdict,
        reason: judgment.reason.trim(),
      } satisfies FormulaMaterialJudgment;
    });

    return {
      plan: {
        materialVectors: normalized.materialVectors,
        intentVector: [],
        focusMode: normalized.focusMode,
        requestedElementBias: input.formula.pattern.dominantElement,
      },
      materialJudgments,
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('LLM alchemy formula analysis timeout')),
            this.options.timeoutMs ?? 20_000,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

export const alchemyFormulaAnalyzer = new AlchemyFormulaAnalyzer();
