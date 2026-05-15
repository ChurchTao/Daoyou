import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { MATERIAL_ALCHEMY_TAG_LABELS } from '@shared/config/alchemyProfile';
import { ELEMENT_VALUES, type ElementType } from '@shared/types/constants';
import {
  MATERIAL_ALCHEMY_EFFECT_TAG_VALUES,
  type MaterialAlchemyEffectTag,
} from '@shared/types/consumable';
import { z } from 'zod';

const ALCHEMY_FOCUS_MODE_VALUES = ['focused', 'balanced', 'risky'] as const;

const AlchemyIntentResolutionSchema = z.object({
  targetTags: z
    .array(z.enum(MATERIAL_ALCHEMY_EFFECT_TAG_VALUES))
    .min(1)
    .max(3),
  focusMode: z.enum(ALCHEMY_FOCUS_MODE_VALUES),
  requestedElementBias: z.enum(ELEMENT_VALUES).optional(),
});

export type AlchemyFocusMode = (typeof ALCHEMY_FOCUS_MODE_VALUES)[number];

export interface AlchemyIntentResolution {
  targetTags: MaterialAlchemyEffectTag[];
  focusMode: AlchemyFocusMode;
  requestedElementBias?: ElementType;
}

const TAG_INTENT_GUIDE = MATERIAL_ALCHEMY_EFFECT_TAG_VALUES.map(
  (tag) => `- ${tag}: ${MATERIAL_ALCHEMY_TAG_LABELS[tag]}`,
).join('\n');

export class AlchemyIntentResolver {
  constructor(
    private readonly options: {
      timeoutMs?: number;
      fastModel?: boolean;
    } = {},
  ) {}

  async resolve(userPrompt: string): Promise<AlchemyIntentResolution> {
    const prompt = userPrompt.trim();
    if (!prompt) {
      throw new Error('empty alchemy intent');
    }

    const { system, user } = renderPrompt('alchemy-intent', {
      tagGuide: TAG_INTENT_GUIDE,
      userPrompt: prompt,
    });

    const response = await this.withTimeout(
      object(
        system,
        user,
        {
          schema: AlchemyIntentResolutionSchema,
          schemaName: 'AlchemyIntentResolution',
        },
        this.options.fastModel ?? true,
      ),
    );

    const targetTags = Array.from(new Set(response.object.targetTags));
    if (targetTags.length === 0) {
      throw new Error('empty alchemy target tags');
    }

    return {
      targetTags,
      focusMode: response.object.focusMode,
      requestedElementBias: response.object.requestedElementBias,
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM alchemy intent timeout')),
          this.options.timeoutMs ?? 20_000,
        );
      }),
    ]);
  }
}

export const alchemyIntentResolver = new AlchemyIntentResolver();
