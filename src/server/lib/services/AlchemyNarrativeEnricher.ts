import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { formatAlchemyPropertyVector } from '@shared/lib/alchemyProperties';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getResourceLabel, getResourceText } from '@shared/lib/gameConceptDisplay';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type {
  ConditionStatusKey,
  ConditionTrackPath,
} from '@shared/types/condition';
import type { ElementType, Quality } from '@shared/types/constants';
import type {
  AlchemyFocusMode,
  ConditionOperation,
  PillFamily,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import { z } from 'zod';

function formatPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

function getPillFamilyLabel(family: PillFamily): string {
  switch (family) {
    case 'healing':
      return '疗伤丹';
    case 'mana':
      return '回元丹';
    case 'detox':
      return '解毒丹';
    case 'cultivation':
      return '养元丹';
    case 'insight':
      return '悟心丹';
    case 'breakthrough':
      return '破境丹';
    case 'tempering':
      return '炼体丹';
    case 'marrow_wash':
      return '洗髓丹';
    case 'longevity':
      return '延寿丹';
    case 'hybrid':
      return '和元丹';
  }
}

function getStatusName(status: ConditionStatusKey): string {
  return getConditionStatusTemplate(status)?.name ?? status;
}

function describeOperation(operation: ConditionOperation): string {
  switch (operation.type) {
    case 'restore_resource':
      return operation.mode === 'percent'
        ? `恢复最大${getResourceLabel(operation.resource)} ${formatPercent(operation.value)}`
        : `恢复${getResourceLabel(operation.resource)} ${operation.value}`;
    case 'change_gauge':
      return `丹毒 ${operation.delta > 0 ? '+' : ''}${operation.delta}`;
    case 'gain_progress':
      return `${
        operation.target === 'cultivation_exp'
          ? getResourceText('cultivation_exp')
          : getGameConceptLabel('comprehension_insight')
      } +${operation.value}`;
    case 'increase_lifespan':
      return `寿元 +${operation.value} 年`;
    case 'remove_status':
      return `化解「${getStatusName(operation.status)}」`;
    case 'add_status':
      return `获得「${getStatusName(operation.status)}」`;
    case 'advance_track':
      return `推进${getTrackConfig(operation.track).name} +${operation.value}`;
  }
}

function formatLineList(lines: string[]): string {
  if (lines.length === 0) return '无';
  return lines.map((line) => `- ${line}`).join('\n');
}

function formatMaterialList(materialNames: string[]): string {
  if (materialNames.length === 0) return '无';
  return Array.from(new Set(materialNames)).join('、');
}

const improvisedPillCopySchema = z.object({
  name: z.string().min(2).max(24).describe('符合凡人流仙侠气质的丹药名称'),
  description: z
    .string()
    .min(24)
    .max(120)
    .describe('成丹评述，强调炉意与药性，不重复 UI 的效果说明'),
  styleInsight: z.string().max(80).optional(),
});

export type ImprovisedPillCopy = z.infer<typeof improvisedPillCopySchema>;

export interface ImprovisedPillCopyFacts {
  family: PillFamily;
  dominantElement?: ElementType;
  quality: Quality;
  materialNames: string[];
  propertyVector: WeightedAlchemyProperty[];
  operations: ConditionOperation[];
  stability: number;
  toxicityRating: number;
  userPrompt: string;
  focusMode: AlchemyFocusMode;
}

const DEFAULT_NARRATIVE_TIMEOUT_MS = 30_000;

export class AlchemyNarrativeEnricher {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(options: { enabled?: boolean; timeoutMs?: number } = {}) {
    this.enabled =
      options.enabled ?? AlchemyNarrativeEnricher.resolveDefaultEnabled();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_NARRATIVE_TIMEOUT_MS;
  }

  private static resolveDefaultEnabled(): boolean {
    if (process.env.DISABLE_LLM_NAMING === 'true') return false;
    if (process.env.ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async generateImprovisedPillCopy(
    facts: ImprovisedPillCopyFacts,
  ): Promise<ImprovisedPillCopy | null> {
    if (!this.enabled) return null;

    try {
      const variables = this.buildImprovisedPillVariables(facts);
      const { system, user } = renderPrompt(
        'alchemy-improvised-copy',
        variables,
      );
      const response = await this.withTimeout(
        object(
          system,
          user,
          {
            schema: improvisedPillCopySchema,
            schemaName: 'ImprovisedPillCopy',
            sceneId: 'alchemy-improvised-copy',
          },
          true,
        ),
      );
      return response.object;
    } catch (error) {
      console.error(
        '[AlchemyNarrativeEnricher] improvised copy failed:',
        error,
      );
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM alchemy narrative timeout')),
          this.timeoutMs,
        );
      }),
    ]);
  }

  private buildImprovisedPillVariables(facts: ImprovisedPillCopyFacts) {
    return {
      familyText: getPillFamilyLabel(facts.family),
      qualityText: facts.quality,
      elementText: facts.dominantElement ?? '未显主元素',
      materialsText: formatMaterialList(facts.materialNames),
      propertyVectorText: formatAlchemyPropertyVector(facts.propertyVector),
      operationLinesText: formatLineList(
        facts.operations.map(describeOperation),
      ),
      stabilityText: String(facts.stability),
      toxicityText: String(facts.toxicityRating),
      userPromptText: facts.userPrompt.trim(),
      focusModeText: this.getFocusModeText(facts.focusMode),
    };
  }

  private getFocusModeText(
    focusMode: ImprovisedPillCopyFacts['focusMode'],
  ): string {
    switch (focusMode) {
      case 'focused':
        return '专精凝意';
      case 'balanced':
        return '调和并济';
      case 'risky':
        return '险进催化';
    }
  }
}

export function getAlchemyNarrativeOperationLines(
  operations: ConditionOperation[],
): string[] {
  return operations.map(describeOperation);
}

export function getAlchemyNarrativeTrackName(
  track: ConditionTrackPath,
): string {
  return getTrackConfig(track).name;
}
