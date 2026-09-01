import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import { SPIRIT_FIELD_METHOD_MAP, getAffinityScore, type SpiritFieldCultivationMethod, type SpiritFieldHarvestSettlement, type SpiritFieldPlantSnapshot, type SpiritFieldStageHistory, type SpiritFieldStageJudgment } from '@shared/engine/spirit-field';
import { z } from 'zod';

const judgmentSchema = z.object({
  affinity: z.enum(['excellent', 'good', 'neutral', 'strained']),
  feedback: z.string().trim().min(20).max(160),
}).strict();
const finalIdentitySchema = z.object({
  name: z.string().trim().min(2).max(12),
  description: z.string().trim().min(24).max(180),
}).strict();

function fallbackJudgment(plant: SpiritFieldPlantSnapshot, method: SpiritFieldCultivationMethod): SpiritFieldStageJudgment {
  const name = SPIRIT_FIELD_METHOD_MAP[method].name;
  if (plant.preferredMethods.includes(method)) return { affinity: 'excellent', feedback: `这枚灵种对${name}显出清晰回应，种壳与根脉间的灵机彼此接续，生长走势变得格外顺畅。` };
  if (plant.avoidedMethods.includes(method)) return { affinity: 'strained', feedback: `${name}触动了灵植不甚相合的一面，所幸根本生机未损，只是这一阶段的灵机运转略显滞涩。` };
  return { affinity: 'neutral', feedback: `${name}稳稳落入田中，灵植并未显出强烈偏好，却也将这股外力逐步纳入自身生长。` };
}

function leaksInternalRules(text: string, plant: SpiritFieldPlantSnapshot): boolean {
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
  return /服(?:下|用|食)|延寿|突破|洗髓|炼体|恢复(?:气血|法力)|增加(?:修为|感悟)|丹毒|\d|%|％/.test(text);
}

export async function judgeSpiritFieldStage(input: { plant: SpiritFieldPlantSnapshot; method: SpiritFieldCultivationMethod; history: SpiritFieldStageHistory[]; resourceName?: string; abortSignal?: AbortSignal }): Promise<SpiritFieldStageJudgment> {
  const fallback = fallbackJudgment(input.plant, input.method);
  const { system, user } = renderPrompt('spirit-field-stage-judgment', { payloadJson: JSON.stringify({ seed: input.plant, method: SPIRIT_FIELD_METHOD_MAP[input.method], history: input.history, resourceName: input.resourceName ?? null }) });
  try {
    const response = await generateAiObject({ system, prompt: user, schema: judgmentSchema, name: 'SpiritFieldStageJudgment', sceneId: 'spirit-field-stage-judgment', abortSignal: input.abortSignal ? AbortSignal.any([input.abortSignal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000), maxOutputTokens: 480 });
    return leaksInternalRules(response.output.feedback, input.plant)
      ? fallback
      : response.output;
  } catch (error) {
    if (input.abortSignal?.aborted) throw error;
    console.warn('[spirit-field] stage judgment fallback', { error });
    return fallback;
  }
}

export async function finalizeSpiritFieldIdentity(input: { plant: SpiritFieldPlantSnapshot; history: SpiritFieldStageHistory[]; settlement: SpiritFieldHarvestSettlement; abortSignal?: AbortSignal }): Promise<{ name: string; description: string }> {
  const outcomeLabel = input.settlement.outcomeKind === 'herb' ? '灵草材料' : input.settlement.outcomeKind === 'tcdb' ? '天材地宝材料' : '可服用灵果';
  const fallback = { name: input.settlement.outcomeKind === 'spirit_fruit' ? `${input.plant.element}纹灵果` : input.settlement.outcomeKind === 'tcdb' ? `${input.plant.element}蕴灵华` : `${input.plant.element}脉灵草`, description: `此物由${input.plant.seedName}历经萌芽、蕴灵与成型三度造化而成，最终凝作${outcomeLabel}，其形貌与灵韵仍留有培育手段的痕迹。` };
  const { system, user } = renderPrompt('spirit-field-finalization', { payloadJson: JSON.stringify({ seed: input.plant, cultivationHistory: input.history, fixedSettlement: { ...input.settlement, outcomeLabel } }) });
  try {
    const response = await generateAiObject({ system, prompt: user, schema: finalIdentitySchema, name: 'SpiritFieldFinalIdentity', sceneId: 'spirit-field-finalization', abortSignal: input.abortSignal ? AbortSignal.any([input.abortSignal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000), maxOutputTokens: 520 });
    return leaksInternalRules(response.output.description, input.plant) ||
      inventsProductEffects(response.output.description)
      ? fallback
      : response.output;
  } catch (error) {
    if (input.abortSignal?.aborted) throw error;
    console.warn('[spirit-field] final identity fallback', { error });
    return fallback;
  }
}

export function stageJudgmentScore(judgment: SpiritFieldStageJudgment): number { return getAffinityScore(judgment.affinity); }
