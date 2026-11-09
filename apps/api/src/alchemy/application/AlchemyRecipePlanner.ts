import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import {
  ALCHEMY_FOCUS_MODE_VALUES,
  type AlchemyRecipePlan,
} from '@daoyou/game-domain/consumables';
import {
  GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES,
  getAlchemyPropertyLabel,
  mergeAlchemyMaterialPropertyHints,
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

const materialVectorSchema = z.object({
  materialRef: z.string().min(1),
  properties: z.array(weightedAlchemyPropertySchema).min(1).max(3),
});

const alchemyRecipePlanSchema = z.object({
  materialVectors: z.array(materialVectorSchema).min(1),
  intentVector: z.array(weightedAlchemyPropertySchema).max(3).default([]),
  focusMode: z.enum(ALCHEMY_FOCUS_MODE_VALUES),
  requestedElementBias: z.enum(ELEMENT_VALUES).optional(),
});

function buildPropertyGuide(): string {
  return GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES.map(
    (key) => `- ${key}: ${getAlchemyPropertyLabel(key)}`,
  ).join('\n');
}

function normalizePlan(plan: z.infer<typeof alchemyRecipePlanSchema>) {
  return {
    ...plan,
    materialVectors: plan.materialVectors.map((vector) => ({
      ...vector,
      properties: normalizeWeightedAlchemyProperties(vector.properties).slice(
        0,
        3,
      ),
    })),
    intentVector: normalizeWeightedAlchemyProperties(plan.intentVector).slice(
      0,
      3,
    ),
  };
}

export class AlchemyRecipePlanner {
  constructor(
    private readonly ai: AiService,
    private readonly options: {
      timeoutMs?: number;
    } = {},
  ) {}

  async plan(input: {
    materials: PreparedAlchemyMaterial[];
    userPrompt?: string;
  }): Promise<AlchemyRecipePlan> {
    const payloadJson = stableCompactStringify({
      materials: input.materials.map((material) => ({
        materialRef: material.materialRef,
        materialName: material.name,
        type: material.type,
        rank: material.rank,
        element: material.element,
        dose: material.dose,
        description: truncateText(material.description, 64),
      })),
      userPrompt: input.userPrompt?.trim() || '',
    });

    const { system, user } = renderPrompt('alchemy-recipe-plan', {
      propertyGuide: buildPropertyGuide(),
      payloadJson,
      hasUserPrompt: input.userPrompt?.trim() ? 'true' : 'false',
    });

    const response = await this.ai.generateObject({
      model: 'alibaba.fast',
      abortSignal: aiDeadlineSignal(this.options.timeoutMs ?? 20_000),
      instructions: system,
      prompt: user,
      schema: alchemyRecipePlanSchema,
      schemaName: 'AlchemyRecipePlan',
      label: 'alchemy-recipe-plan',
    });

    const normalized = normalizePlan(response.object);
    const materialMap = new Map(
      input.materials.map((material) => [material.materialRef, material]),
    );

    if (normalized.materialVectors.length !== input.materials.length) {
      throw new Error(
        'alchemy planner returned mismatched material vector count',
      );
    }

    // [安全守卫] 检测重复的 materialRef，防止 LLM 伪造多个向量指向同一材料以操纵药性权重
    const seenRefs = new Set<string>();
    for (const vector of normalized.materialVectors) {
      if (seenRefs.has(vector.materialRef)) {
        throw new Error(
          `alchemy planner returned duplicate materialRef: ${vector.materialRef}`,
        );
      }
      seenRefs.add(vector.materialRef);
    }

    const materialVectors = normalized.materialVectors.map((vector) => {
      const material = materialMap.get(vector.materialRef);
      if (!material) {
        throw new Error(
          `alchemy planner returned unknown material ref: ${vector.materialRef}`,
        );
      }
      if (vector.properties.length === 0) {
        throw new Error(
          `alchemy planner returned empty property vector: ${vector.materialRef}`,
        );
      }
      return mergeAlchemyMaterialPropertyHints(
        {
          ...vector,
          materialName: material.name,
        },
        material,
      );
    });

    if (!input.userPrompt?.trim()) {
      normalized.intentVector = [];
      normalized.focusMode = 'balanced';
      normalized.requestedElementBias = undefined;
    }

    return {
      ...normalized,
      materialVectors,
    };
  }
}
