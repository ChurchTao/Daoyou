import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import {
  GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES,
  getAlchemyPropertyLabel,
  normalizeWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import { mergeAlchemyMaterialPropertyHints } from '@shared/lib/alchemyMaterialHints';
import { ELEMENT_VALUES } from '@shared/types/constants';
import {
  ALCHEMY_FOCUS_MODE_VALUES,
  type AlchemyRecipePlan,
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

function normalizePlan(plan: AlchemyRecipePlan): AlchemyRecipePlan {
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
    private readonly options: {
      timeoutMs?: number;
      fastModel?: boolean;
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

    const response = await this.withTimeout(
      object(
        system,
        user,
        {
          schema: alchemyRecipePlanSchema,
          schemaName: 'AlchemyRecipePlan',
          sceneId: 'alchemy-recipe-plan',
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

    for (const vector of normalized.materialVectors) {
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
      vector.materialName = material.name;
      vector.properties = mergeAlchemyMaterialPropertyHints(vector, material).properties;
    }

    if (!input.userPrompt?.trim()) {
      normalized.intentVector = [];
      normalized.focusMode = 'balanced';
      normalized.requestedElementBias = undefined;
    }

    return normalized;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM alchemy recipe plan timeout')),
          this.options.timeoutMs ?? 20_000,
        );
      }),
    ]);
  }
}

export const alchemyRecipePlanner = new AlchemyRecipePlanner();
