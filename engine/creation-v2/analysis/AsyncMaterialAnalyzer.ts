import { Material } from '@/types/cultivator';
import {
  MaterialFingerprint,
  MaterialFingerprintMetadata,
} from '../types';
import { DefaultMaterialAnalyzer } from './DefaultMaterialAnalyzer';
import {
  DeepSeekMaterialSemanticEnricher,
  MaterialSemanticEnricher,
  MaterialSemanticEnrichmentReport,
} from './MaterialSemanticEnricher';

export interface AsyncMaterialAnalysisResult {
  fingerprints: MaterialFingerprint[];
  enrichment: MaterialSemanticEnrichmentReport;
}

export class AsyncMaterialAnalyzer {
  constructor(
    private readonly baseAnalyzer = new DefaultMaterialAnalyzer(),
    private readonly semanticEnricher: MaterialSemanticEnricher =
      new DeepSeekMaterialSemanticEnricher(),
  ) {}

  async analyze(materials: Material[]): Promise<AsyncMaterialAnalysisResult> {
    const baseFingerprints = this.baseAnalyzer.analyze(materials);
    const enrichment = await this.semanticEnricher.enrich(
      materials,
      baseFingerprints,
    );

    const fingerprints = baseFingerprints.map((fingerprint) => {
      const entry = enrichment.materials.find(
        (item) =>
          item.materialId === fingerprint.materialId ||
          item.materialName === fingerprint.materialName,
      );

      const semanticTags = Array.from(
        new Set([
          ...fingerprint.semanticTags,
          ...(entry?.addedTags ?? []),
        ]),
      );

      const metadata: MaterialFingerprintMetadata = {
        ...(fingerprint.metadata ?? {}),
        llm: {
          status: enrichment.status,
          failureDisposition: enrichment.failureDisposition,
          confidence: entry?.confidence,
          addedTags: entry?.addedTags ?? [],
          droppedTags: entry?.droppedTags ?? [],
          reason: entry?.reason ?? enrichment.fallbackReason,
          batchInsight: enrichment.batchInsight,
          provider: enrichment.provider,
        },
      };

      return {
        ...fingerprint,
        semanticTags,
        metadata,
      };
    });

    return {
      fingerprints,
      enrichment,
    };
  }
}