import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import {
  getCareQiCost,
  type SpiritFieldCarePlan,
  type SpiritFieldObservation,
  type SpiritFieldPlantSnapshot,
} from '@shared/engine/spirit-field';
import { ELEMENT_VALUES } from '@shared/types/constants';
import { z } from 'zod';

const interpretationSchema = z.object({
  action: z.enum([
    'dry_soil',
    'moisten',
    'wood_nurture',
    'loosen_soil',
    'fertilize',
    'observe',
    'wait',
  ]),
  element: z.enum(ELEMENT_VALUES).optional(),
  intensity: z.enum(['light', 'moderate']),
  target: z.enum(['soil', 'root', 'leaf', 'whole']),
  summary: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(160),
  risk: z.string().trim().min(1).max(160),
});

const narrativeSchema = z.object({
  narrative: z.string().trim().min(20).max(220),
});

function fallbackInterpretation(message: string): SpiritFieldCarePlan {
  const text = message.trim();
  const element = ELEMENT_VALUES.find((candidate) => text.includes(candidate));
  let action: SpiritFieldCarePlan['action'] = 'wood_nurture';
  let target: SpiritFieldCarePlan['target'] = 'whole';
  if (/烘|火|祛湿|干燥/.test(text)) {
    action = 'dry_soil';
    target = 'soil';
  } else if (/水|灵泉|浇|润/.test(text)) {
    action = 'moisten';
    target = /叶/.test(text) ? 'leaf' : 'soil';
  } else if (/肥|施肥|肥料|培肥/.test(text)) {
    action = 'fertilize';
    target = 'soil';
  } else if (/疏|松土|翻土/.test(text)) {
    action = 'loosen_soil';
    target = 'soil';
  } else if (/看|观察|检查|感知/.test(text)) {
    action = 'observe';
    target = 'whole';
  } else if (/不管|等待|等等|先放着/.test(text)) {
    action = 'wait';
    target = 'whole';
  } else if (/根/.test(text)) {
    target = 'root';
  }
  return {
    action,
    element,
    intensity: /猛烈|大量|全力|强行/.test(text) ? 'moderate' : 'light',
    target,
    summary:
      action === 'dry_soil'
        ? '以温和手段驱散根部周围的湿气，并尽量避开药根。'
        : action === 'moisten'
          ? '以少量水意或灵泉润养灵植，避免一次灌入过多。'
          : action === 'fertilize'
            ? '向根部附近补充适量肥力，避免一次施入过多伤及根系。'
            : action === 'loosen_soil'
              ? '轻轻疏松根部周围土层，让水气与灵机重新流转。'
              : action === 'observe'
                ? '先细看灵植、土壤与灵气状态，不立即改变田中环境。'
                : action === 'wait'
                  ? '暂时不做额外养护，让灵植继续自然生长。'
                  : '以相对温和的灵力持续温养灵植，重点照顾根系与灵机流转。',
    reason: '系统按你描述的动作、目标与灵力方式进行了归纳。',
    risk: '养护过度可能适得其反，执行时会按服务器规则限制实际效果。',
    qiCost: getCareQiCost(action),
  };
}

export async function interpretSpiritFieldCare(input: {
  message: string;
  plant: SpiritFieldPlantSnapshot;
  observations: SpiritFieldObservation[];
  careCount: number;
  careSlots: number;
  abortSignal?: AbortSignal;
}): Promise<SpiritFieldCarePlan> {
  const fallback = fallbackInterpretation(input.message);
  const { system, user } = renderPrompt('spirit-field-interpret', {
    payloadJson: JSON.stringify({
      playerMessage: input.message,
      plant: {
        name: input.plant.name,
        quality: input.plant.quality,
        element: input.plant.element,
        description: input.plant.description,
        appearance: input.plant.appearance,
        matureSign: input.plant.matureSign,
        growthForm: input.plant.growthForm,
        harvestPart: input.plant.harvestPart,
        habitatTags: input.plant.habitatTags,
        careStyleTags: input.plant.careStyleTags,
        useTags: input.plant.useTags,
      },
      observations: input.observations.map((entry) => ({
        label: entry.label,
        text: entry.text,
      })),
      care: { used: input.careCount, total: input.careSlots },
    }),
  });
  const timeoutSignal = AbortSignal.timeout(10_000);
  const abortSignal = input.abortSignal
    ? AbortSignal.any([input.abortSignal, timeoutSignal])
    : timeoutSignal;
  try {
    const response = await generateAiObject({
      system,
      prompt: user,
      schema: interpretationSchema,
      name: 'SpiritFieldCareInterpretation',
      sceneId: 'spirit-field-interpret',
      abortSignal,
      maxOutputTokens: 600,
    });
    return {
      ...response.output,
      qiCost: getCareQiCost(response.output.action),
    };
  } catch (error) {
    if (input.abortSignal?.aborted) throw error;
    console.warn('[spirit-field] interpretation LLM fallback', { error });
    return fallback;
  }
}

export async function narrateSpiritFieldResult(input: {
  kind: 'care' | 'harvest';
  plantName: string;
  facts: Record<string, unknown>;
  fallback: string;
}): Promise<string> {
  const { system, user } = renderPrompt('spirit-field-narrative', {
    payloadJson: JSON.stringify({
      kind: input.kind,
      plantName: input.plantName,
      facts: input.facts,
    }),
  });
  try {
    const response = await generateAiObject({
      system,
      prompt: user,
      schema: narrativeSchema,
      name: 'SpiritFieldNarrative',
      sceneId: 'spirit-field-narrative',
      abortSignal: AbortSignal.timeout(8_000),
      maxOutputTokens: 420,
    });
    return response.output.narrative;
  } catch (error) {
    console.warn('[spirit-field] narrative LLM fallback', { error });
    return input.fallback;
  }
}
