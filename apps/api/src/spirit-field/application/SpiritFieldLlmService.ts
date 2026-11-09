import {
  SPIRIT_FIELD_METHOD_MAP,
  getAffinityScore,
  type SpiritFieldCultivationMethod,
  type SpiritFieldHarvestSettlement,
  type SpiritFieldPlantSnapshot,
  type SpiritFieldStageHistory,
  type SpiritFieldStageJudgment,
} from '@daoyou/game-rules/spirit-field';
import type { AiService } from '@nestjs/ai';
import { createHash } from 'node:crypto';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { aiDeadlineSignal } from '@server/llm/call-options.js';
import { z } from 'zod';

const judgmentSchema = z.object({
  affinity: z.enum(['excellent', 'good', 'neutral', 'strained']),
  feedback: z.string().trim().min(20).max(160),
}).strict();
const finalIdentitySchema = z.object({
  name: z.string().trim().min(2).max(12),
  description: z.string().trim().min(24).max(180),
}).strict();

const STAGE_JUDGMENT_MODEL = 'alibaba.fast';
const STAGE_JUDGMENT_VERSION = 'v2';
const stageJudgmentSchemaJson = JSON.stringify(judgmentSchema.toJSONSchema());

interface PendingStageJudgment {
  controller: AbortController;
  result: Promise<SpiritFieldStageJudgment>;
  subscribers: number;
  settled: boolean;
}

// Each AiService has its own immutable model registry; never share across registries.
const pendingStageJudgments = new WeakMap<
  AiService,
  Map<string, PendingStageJudgment>
>();

function awaitStageJudgment(
  pending: PendingStageJudgment,
  signal: AbortSignal | undefined,
  removePending: () => void,
): Promise<SpiritFieldStageJudgment> {
  pending.subscribers += 1;
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', abort);
      pending.subscribers -= 1;
      if (!pending.settled && pending.subscribers === 0) {
        removePending();
        pending.controller.abort();
      }
      return true;
    };
    const abort = () => {
      if (release()) reject(signal?.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    void pending.result.then(
      (result) => {
        if (release()) resolve(result);
      },
      (error: unknown) => {
        if (release()) reject(error);
      },
    );
  });
}

function fallbackJudgment(
  plant: SpiritFieldPlantSnapshot,
  method: SpiritFieldCultivationMethod,
): SpiritFieldStageJudgment {
  const name = SPIRIT_FIELD_METHOD_MAP[method].name;
  if (plant.preferredMethods.includes(method))
    return {
      affinity: 'excellent',
      feedback: `这枚灵种对${name}显出清晰回应，种壳与根脉间的灵机彼此接续，生长走势变得格外顺畅。`,
    };
  if (plant.avoidedMethods.includes(method))
    return {
      affinity: 'strained',
      feedback: `${name}触动了灵植不甚相合的一面，所幸根本生机未损，只是这一阶段的灵机运转略显滞涩。`,
    };
  return {
    affinity: 'neutral',
    feedback: `${name}稳稳落入田中，灵植并未显出强烈偏好，却也将这股外力逐步纳入自身生长。`,
  };
}

function leaksInternalRules(
  text: string,
  plant: SpiritFieldPlantSnapshot,
): boolean {
  const hiddenTokens = [
    ...plant.preferredMethods,
    ...plant.avoidedMethods,
    ...plant.preferredHabitats,
    ...plant.avoidedHabitats,
    ...plant.growthTraits,
    ...plant.useTags,
    ...plant.outcomeBiases,
    ...plant.creationTags,
    'excellent',
    'good',
    'neutral',
    'strained',
  ];
  return (
    hiddenTokens.some((token) => text.includes(token)) ||
    /偏好|忌讳|内部(?:规则|标签)|产物倾向|概率|分数|评分/.test(text)
  );
}

function inventsProductEffects(text: string): boolean {
  return /服(?:下|用|食)|延寿|突破|洗髓|炼体|恢复(?:气血|法力)|增加(?:修为|感悟)|丹毒|\d|%|％/.test(
    text,
  );
}

export async function judgeSpiritFieldStage(
  ai: AiService,
  input: {
    plant: SpiritFieldPlantSnapshot;
    method: SpiritFieldCultivationMethod;
    history: SpiritFieldStageHistory[];
    resourceName?: string;
    abortSignal?: AbortSignal;
    /** Server-owned actor/plot state scope; only the model judgment is shared. */
    deduplicationKey?: string;
  },
): Promise<SpiritFieldStageJudgment> {
  input.abortSignal?.throwIfAborted();
  const fallback = fallbackJudgment(input.plant, input.method);
  const plant = input.plant;
  const method = SPIRIT_FIELD_METHOD_MAP[input.method];
  const { system, user } = renderPrompt('spirit-field-stage-judgment', {
    payloadJson: JSON.stringify({
      seed: {
        seedName: plant.seedName,
        seedDescription: plant.seedDescription,
        clueTexts: plant.clueTexts,
        quality: plant.quality,
        element: plant.element,
        growthForm: plant.growthForm,
        harvestPart: plant.harvestPart,
        preferredMethods: plant.preferredMethods,
        avoidedMethods: plant.avoidedMethods,
        preferredHabitats: plant.preferredHabitats,
        avoidedHabitats: plant.avoidedHabitats,
        growthTraits: plant.growthTraits,
        useTags: plant.useTags,
        outcomeBiases: plant.outcomeBiases,
        creationTags: plant.creationTags,
      },
      method: {
        id: method.id,
        stage: method.stage,
        name: method.name,
        description: method.description,
        resourceKind: method.resourceKind,
      },
      history: input.history.map((entry) => ({
        stage: entry.stage,
        method: entry.method,
        affinity: entry.affinity,
        feedback: entry.feedback,
        resourceName: entry.resourceName ?? null,
      })),
      resourceName: input.resourceName ?? null,
    }),
  });
  const generate = async (signal: AbortSignal) => {
    try {
      const response = await ai.generateObject({
        model: STAGE_JUDGMENT_MODEL,
        instructions: system,
        prompt: user,
        schema: judgmentSchema,
        schemaName: 'SpiritFieldStageJudgment',
        label: 'spirit-field-stage-judgment',
        abortSignal: aiDeadlineSignal(12_000, signal),
        maxOutputTokens: 480,
      });
      return leaksInternalRules(response.object.feedback, input.plant)
        ? fallback
        : response.object;
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn('[spirit-field] stage judgment fallback', { error });
      return fallback;
    }
  };
  const key = input.deduplicationKey
    ? createHash('sha256')
        .update(
          JSON.stringify([
            input.deduplicationKey,
            STAGE_JUDGMENT_MODEL,
            STAGE_JUDGMENT_VERSION,
            stageJudgmentSchemaJson,
            system,
            user,
          ]),
        )
        .digest('hex')
    : undefined;
  let tasks = pendingStageJudgments.get(ai);
  if (!tasks) {
    tasks = new Map();
    pendingStageJudgments.set(ai, tasks);
  }
  let pending = key ? tasks.get(key) : undefined;
  const removePending = () => {
    if (key && tasks.get(key) === pending) tasks.delete(key);
  };
  if (!pending) {
    const controller = new AbortController();
    const created: PendingStageJudgment = {
      controller,
      subscribers: 0,
      settled: false,
      result: generate(controller.signal).finally(() => {
        created.settled = true;
        removePending();
      }),
    };
    pending = created;
    if (key) tasks.set(key, pending);
  }
  return awaitStageJudgment(pending, input.abortSignal, removePending);
}

export async function finalizeSpiritFieldIdentity(
  ai: AiService,
  input: {
    plant: SpiritFieldPlantSnapshot;
    history: SpiritFieldStageHistory[];
    settlement: SpiritFieldHarvestSettlement;
    abortSignal?: AbortSignal;
  },
): Promise<{ name: string; description: string }> {
  const outcomeLabel =
    input.settlement.outcomeKind === 'herb'
      ? '灵草材料'
      : input.settlement.outcomeKind === 'tcdb'
        ? '天材地宝材料'
        : '可服用灵果';
  const fallback = {
    name:
      input.settlement.outcomeKind === 'spirit_fruit'
        ? `${input.plant.element}纹灵果`
        : input.settlement.outcomeKind === 'tcdb'
          ? `${input.plant.element}蕴灵华`
          : `${input.plant.element}脉灵草`,
    description: `此物由${input.plant.seedName}历经萌芽、蕴灵与成型三度造化而成，最终凝作${outcomeLabel}，其形貌与灵韵仍留有培育手段的痕迹。`,
  };
  const { system, user } = renderPrompt('spirit-field-finalization', {
    payloadJson: JSON.stringify({
      seed: input.plant,
      cultivationHistory: input.history,
      fixedSettlement: { ...input.settlement, outcomeLabel },
    }),
  });
  try {
    const response = await ai.generateObject({
      model: 'alibaba.fast',
      instructions: system,
      prompt: user,
      schema: finalIdentitySchema,
      schemaName: 'SpiritFieldFinalIdentity',
      label: 'spirit-field-finalization',
      abortSignal: aiDeadlineSignal(12_000, input.abortSignal),
      maxOutputTokens: 520,
    });
    return leaksInternalRules(response.object.description, input.plant) ||
      inventsProductEffects(response.object.description)
      ? fallback
      : response.object;
  } catch (error) {
    if (input.abortSignal?.aborted) throw error;
    console.warn('[spirit-field] final identity fallback', { error });
    return fallback;
  }
}

export function stageJudgmentScore(judgment: SpiritFieldStageJudgment): number { return getAffinityScore(judgment.affinity); }
