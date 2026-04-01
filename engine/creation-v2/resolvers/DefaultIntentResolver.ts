import { EquipmentSlot } from '@/types/constants';
import { CreationIntent, CreationSessionInput, MaterialFingerprint } from '../types';

export class DefaultIntentResolver {
  resolve(
    input: CreationSessionInput,
    fingerprints: MaterialFingerprint[],
  ): CreationIntent {
    const outcomeKind =
      input.productType === 'skill' ? 'active_skill' : input.productType;
    const dominantTags = this.pickDominantTags(fingerprints, input.requestedTags ?? []);

    return {
      productType: input.productType,
      outcomeKind,
      dominantTags,
      requestedTags: input.requestedTags ?? [],
      elementBias: this.pickElementBias(fingerprints, input.requestedElement),
      slotBias: input.requestedSlot ?? this.inferSlotBias(input.productType, fingerprints),
    };
  }

  private pickDominantTags(
    fingerprints: MaterialFingerprint[],
    requestedTags: string[],
  ): string[] {
    const scores = new Map<string, number>();

    requestedTags.forEach((tag) => scores.set(tag, 100));

    fingerprints.forEach((fingerprint) => {
      [...fingerprint.semanticTags, ...fingerprint.recipeTags].forEach((tag) => {
        scores.set(tag, (scores.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(scores.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([tag]) => tag);
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

    return 'weapon';
  }
}