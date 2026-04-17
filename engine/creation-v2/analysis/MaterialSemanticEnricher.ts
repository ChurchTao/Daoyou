import z from 'zod';
import { object } from '@/utils/aiClient';
import { Material } from '@/types/cultivator';
import {
  MaterialFingerprint,
  MaterialFingerprintLLMMetadata,
} from '../types';
import {
  getCreationMaterialSemanticTagAllowlist,
  normalizeSemanticTags,
} from './SemanticTagAllowlist';

export interface MaterialSemanticEnrichmentItem {
  materialId?: string;
  materialName: string;
  addedTags: string[];
  droppedTags: string[];
  confidence?: number;
  reason?: string;
}

export interface MaterialSemanticEnrichmentReport {
  status: 'disabled' | 'success' | 'fallback';
  provider: string;
  batchInsight?: string;
  fallbackReason?: string;
  failureDisposition?: 'retryable' | 'non_retryable';
  materials: MaterialSemanticEnrichmentItem[];
}

export interface MaterialSemanticEnricher {
  enrich(
    materials: Material[],
    fingerprints: MaterialFingerprint[],
  ): Promise<MaterialSemanticEnrichmentReport>;
}

const enrichmentSchema = z.object({
  batchInsight: z.string().optional(),
  materials: z.array(
    z.object({
      materialId: z.string().optional(),
      materialName: z.string(),
      additionalSemanticTags: z.array(z.string()).default([]),
      confidence: z.number().min(0).max(1).optional(),
      reason: z.string().optional(),
    }),
  ),
});

export interface DeepSeekMaterialSemanticEnricherOptions {
  enabled?: boolean;
  timeoutMs?: number;
  fastModel?: boolean;
  providerName?: string;
}

/*
 * DeepSeekMaterialSemanticEnricher: 使用 DeepSeek（结构化输出）为材料补充语义标签的实现。
 * 特性：
 *  - 可选启用（enabled），在未启用时返回 status='disabled'
 *  - 将 LLM 输出的 additionalSemanticTags 经过白名单归一化并返回
 *  - 在错误或超时情况下返回 fallback 报告，并标注是否可重试（failureDisposition）
 */
export class DeepSeekMaterialSemanticEnricher
  implements MaterialSemanticEnricher
{
  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private readonly fastModel: boolean;
  private readonly providerName: string;

  constructor(options: DeepSeekMaterialSemanticEnricherOptions = {}) {
    this.enabled =
      options.enabled ?? false;
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fastModel = options.fastModel ?? true;
    this.providerName = options.providerName ?? 'deepseek-structured';
  }

  async enrich(
    materials: Material[],
    fingerprints: MaterialFingerprint[],
  ): Promise<MaterialSemanticEnrichmentReport> {
    if (!this.enabled) {
      return {
        status: 'disabled',
        provider: this.providerName,
        materials: fingerprints.map((fingerprint) => ({
          materialId: fingerprint.materialId,
          materialName: fingerprint.materialName,
          addedTags: [],
          droppedTags: [],
        })),
      };
    }

    try {
      const response = await this.withTimeout(
        object(
          this.buildSystemPrompt(),
          JSON.stringify(
            {
              allowlist: getCreationMaterialSemanticTagAllowlist(),
              materials: materials.map((material, index) => ({
                materialId: material.id,
                materialName: material.name,
                description: material.description,
                rank: material.rank,
                type: material.type,
                element: material.element,
                existingRuleTags: fingerprints[index]?.semanticTags ?? [],
              })),
            },
            null,
            2,
          ),
          {
            schema: enrichmentSchema,
            schemaName: 'CreationMaterialSemanticEnrichment',
          },
          this.fastModel,
        ),
      );

      return {
        status: 'success',
        provider: this.providerName,
        batchInsight: response.object.batchInsight,
        materials: response.object.materials.map((item) => {
          const normalized = normalizeSemanticTags(item.additionalSemanticTags);
          return {
            materialId: item.materialId,
            materialName: item.materialName,
            addedTags: normalized.tags,
            droppedTags: normalized.droppedTags,
            confidence: item.confidence,
            reason: item.reason,
          };
        }),
      };
    } catch (error) {
      const fallbackReason =
        error instanceof Error ? error.message : '未知 enrichment 错误';
      return {
        status: 'fallback',
        provider: this.providerName,
        fallbackReason,
        failureDisposition: this.classifyFailureDisposition(fallbackReason),
        materials: fingerprints.map((fingerprint) => ({
          materialId: fingerprint.materialId,
          materialName: fingerprint.materialName,
          addedTags: [],
          droppedTags: [],
          reason: fallbackReason,
        })),
      };
    }
  }

  createFingerprintMetadata(
    report: MaterialSemanticEnrichmentReport,
    fingerprint: MaterialFingerprint,
  ): MaterialFingerprintLLMMetadata {
    const entry = report.materials.find(
      (item) =>
        item.materialId === fingerprint.materialId ||
        item.materialName === fingerprint.materialName,
    );

    return {
      status: report.status,
      failureDisposition: report.failureDisposition,
      confidence: entry?.confidence,
      addedTags: entry?.addedTags ?? [],
      droppedTags: entry?.droppedTags ?? [],
      reason: entry?.reason ?? report.fallbackReason,
      batchInsight: report.batchInsight,
      provider: report.provider,
    };
  }

  private classifyFailureDisposition(
    fallbackReason: string,
  ): 'retryable' | 'non_retryable' {
    return /timeout|timed out|network|rate limit|temporarily|temporary|503|429/i.test(
      fallbackReason,
    )
      ? 'retryable'
      : 'non_retryable';
  }

  private buildSystemPrompt(): string {
    return `你是造物系统的材料语义标签提取器。

目标：仅为材料补充额外的 canonical semantic tags，用于后续规则系统命中。

严格要求：
1. 只能从输入中的 allowlist 选择标签，不得创造新标签。
2. 不要返回解释型文本作为 tag。
3. 若无法判断，返回空数组。
4. confidence 取值范围为 0 到 1。`;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('LLM semantic enrichment timeout')), this.timeoutMs);
      }),
    ]);
  }
}