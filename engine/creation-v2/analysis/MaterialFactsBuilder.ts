/*
 * MaterialFactsBuilder: 将多个 MaterialFingerprint 聚合为 MaterialFacts，计算 dominantTags、unlockScore
 * 与 spendable energy 等汇总字段。
 * 该类是 rules 层评估所需 Facts 的构造器，保证 rules 输入的一致性。
 */
import {
  buildMaterialEnergyProfile,
  buildMaterialQualityProfile,
} from './MaterialBalanceProfile';
import { MaterialFacts } from '../rules/contracts';
import { CreationProductType, MaterialFingerprint } from '../types';
import { CREATION_MATERIAL_FACTS } from '../config/CreationBalance';

export class MaterialFactsBuilder {
  build(
    productType: CreationProductType,
    fingerprints: MaterialFingerprint[],
    requestedTags: string[] = [],
  ): MaterialFacts {
    const energyProfile = buildMaterialEnergyProfile(fingerprints);
    const qualityProfile = buildMaterialQualityProfile(fingerprints);

    return {
      productType,
      fingerprints,
      normalizedTags: this.collectNormalizedTags(fingerprints),
      recipeTags: this.collectRecipeTags(fingerprints),
      requestedTags,
      dominantTags: MaterialFactsBuilder.pickDominantTags(fingerprints, requestedTags),
      energyProfile,
      qualityProfile,
      unlockScore: energyProfile.unlockScore,
    };
  }

  /**
   * 提取主导语义标签：请求标签按配置权重加分，材料语义/配方标签按出现次数加权，取前 4 个。
   * 公开静态方法以供其他模块复用（如 DefaultIntentResolver）。
   */
  static pickDominantTags(
    fingerprints: MaterialFingerprint[],
    requestedTags: string[],
  ): string[] {
    const scores = new Map<string, number>();

    requestedTags.forEach((tag) => scores.set(tag, CREATION_MATERIAL_FACTS.requestedTagWeight));

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

  private collectNormalizedTags(
    fingerprints: MaterialFingerprint[],
  ): string[] {
    return Array.from(
      new Set(
        fingerprints.flatMap((fingerprint) => [
          ...fingerprint.explicitTags,
          ...fingerprint.semanticTags,
          ...fingerprint.recipeTags,
        ]),
      ),
    );
  }

  private collectRecipeTags(fingerprints: MaterialFingerprint[]): string[] {
    return Array.from(
      new Set(fingerprints.flatMap((fingerprint) => fingerprint.recipeTags)),
    );
  }
}