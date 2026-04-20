/*
 * DefaultIntentResolver: 基本的意图解析实现（启发式）。
 * 将用户输入与材料指纹合并，推断 CreationIntent（产物类型、dominant tags、元素/槽位偏好等）。
 * 注意：一些启发式逻辑（如槽位推断）应未来迁移到规则层以便审计。
 */
import { EquipmentSlot } from '@/types/constants';
import { MaterialFactsBuilder } from '../analysis/MaterialFactsBuilder';
import { RuleTraceEntry } from '../rules/core/types';
import {
  CreationIntent,
  CreationIntentSlotBiasSource,
  CreationSessionInput,
  MaterialFingerprint,
} from '../types';

export class DefaultIntentResolver {
  resolve(
    input: CreationSessionInput,
    fingerprints: MaterialFingerprint[],
  ): CreationIntent {
    const outcomeKind =
      input.productType === 'skill' ? 'active_skill' : input.productType;
    const dominantTags = MaterialFactsBuilder.pickDominantTags(
      fingerprints,
      input.requestedTags ?? [],
    );
    const slotBiasResolution = this.resolveSlotBias(input, fingerprints);

    return {
      productType: input.productType,
      outcomeKind,
      dominantTags,
      requestedTags: input.requestedTags ?? [],
      elementBias: this.pickElementBias(fingerprints, input.requestedElement),
      slotBias: slotBiasResolution.slotBias,
      slotBiasSource: slotBiasResolution.slotBiasSource,
      trace: slotBiasResolution.trace,
    };
  }

  private pickElementBias(
    fingerprints: MaterialFingerprint[],
    requestedElement?: CreationSessionInput['requestedElement'],
  ) {
    if (requestedElement) {
      return requestedElement;
    }

    const counts = new Map<string, number>();

    fingerprints.forEach((fingerprint) => {
      if (!fingerprint.element) {
        return;
      }

      counts.set(fingerprint.element, (counts.get(fingerprint.element) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] as
      | CreationSessionInput['requestedElement']
      | undefined;
  }

  /**
   * Heuristic slot inference based on material name keywords.
   * When no keyword matches, defaults to 'weapon' — this is intentionally a fallback.
   *
   * TODO(P1-4): This heuristic belongs in the rules layer (MaterialTagNormalizer or a dedicated
   * SlotBiasRule), so it can produce proper RuleTrace entries. Move when adding slot-specific rules.
   */
  private resolveSlotBias(
    input: CreationSessionInput,
    fingerprints: MaterialFingerprint[],
  ): {
    slotBias?: EquipmentSlot;
    slotBiasSource?: CreationIntentSlotBiasSource;
    trace: RuleTraceEntry[];
  } {
    if (input.productType !== 'artifact') {
      return { slotBias: undefined, trace: [] };
    }

    if (input.requestedSlot) {
      return {
        slotBias: input.requestedSlot,
        slotBiasSource: 'requested',
        trace: [
          {
            ruleId: 'intent.slot_bias',
            outcome: 'applied',
            message: '使用调用方显式指定的 artifact 槽位',
            details: {
              slotBias: input.requestedSlot,
              source: 'requested',
            },
          },
        ],
      };
    }

    const inferredSlotBias = this.inferSlotBias(input.productType, fingerprints);
    if (inferredSlotBias === 'armor') {
      return {
        slotBias: inferredSlotBias,
        slotBiasSource: 'inferred_keyword_armor',
        trace: [
          {
            ruleId: 'intent.slot_bias',
            outcome: 'applied',
            message: '按材料关键词推断 artifact 槽位为 armor',
            details: {
              slotBias: inferredSlotBias,
              source: 'inferred_keyword_armor',
            },
          },
        ],
      };
    }

    if (inferredSlotBias === 'accessory') {
      return {
        slotBias: inferredSlotBias,
        slotBiasSource: 'inferred_keyword_accessory',
        trace: [
          {
            ruleId: 'intent.slot_bias',
            outcome: 'applied',
            message: '按材料关键词推断 artifact 槽位为 accessory',
            details: {
              slotBias: inferredSlotBias,
              source: 'inferred_keyword_accessory',
            },
          },
        ],
      };
    }

    return {
      slotBias: 'weapon',
      slotBiasSource: 'default_weapon_fallback',
      trace: [
        {
          ruleId: 'intent.slot_bias',
          outcome: 'applied',
          message: '未匹配到 artifact 槽位关键词，回退为 weapon',
          details: {
            slotBias: 'weapon',
            source: 'default_weapon_fallback',
          },
        },
      ],
    };
  }

  private inferSlotBias(
    productType: CreationSessionInput['productType'],
    fingerprints: MaterialFingerprint[],
  ): EquipmentSlot | undefined {
    if (productType !== 'artifact') {
      return undefined;
    }

    const combinedText = fingerprints.map((fingerprint) => fingerprint.materialName).join(' ');
    if (/甲|铠|衣/u.test(combinedText)) {
      return 'armor';
    }

    if (/戒|坠|佩/u.test(combinedText)) {
      return 'accessory';
    }

    // No keyword matched — defaulting to weapon slot.
    // TODO(P1-1): Move this heuristic to SlotBiasRule in the rules layer so the
    // fallback decision is captured in RuleTrace rather than silently applied.
    return 'weapon';
  }
}