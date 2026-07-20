import type { SectTaskActionRendererProps } from '@app/components/feature/sect/SectTaskActions';
import type {
  SectTaskActionOutcome,
  SectTaskViewData,
} from '@shared/contracts/sect';
import type { ComponentType } from 'react';
import type { ZodType } from 'zod';

export interface SectActionRendererContribution {
  key: string;
  renderer: ComponentType<SectTaskActionRendererProps>;
}

export interface SectOutcomeContribution<T = unknown> {
  key: string;
  schema: ZodType<T>;
  renderer: ComponentType<SectOutcomeRendererProps<unknown>>;
}

export interface SectOutcomeRendererProps<T> {
  task: SectTaskViewData;
  data: T;
}

export interface SectTaskRendererPluginManifest {
  sectId: string;
  actions?: readonly SectActionRendererContribution[];
  outcomes?: readonly SectOutcomeContribution[];
}

export interface DecodedSectTaskOutcome {
  renderer: string;
  data: unknown;
}

export type SectOutcomeDecodeResult =
  { ok: true; value: DecodedSectTaskOutcome } | { ok: false; error: string };

export class SectTaskRendererRegistry {
  private readonly actions = new Map<
    string,
    ComponentType<SectTaskActionRendererProps>
  >();
  private readonly outcomes = new Map<string, SectOutcomeContribution>();

  constructor(private readonly knownSectIds: readonly string[]) {}

  register(manifest: SectTaskRendererPluginManifest): void {
    if (
      manifest.sectId !== '*' &&
      !this.knownSectIds.includes(manifest.sectId)
    ) {
      throw new Error(`宗门任务渲染插件没有对应内容模块：${manifest.sectId}`);
    }
    for (const contribution of manifest.actions ?? []) {
      if (this.actions.has(contribution.key))
        throw new Error(`宗门任务展示器重复注册：${contribution.key}`);
      this.actions.set(contribution.key, contribution.renderer);
    }
    for (const contribution of manifest.outcomes ?? []) {
      if (this.outcomes.has(contribution.key))
        throw new Error(`宗门任务结果展示器重复注册：${contribution.key}`);
      this.outcomes.set(contribution.key, contribution);
    }
  }

  action(key: string) {
    return this.actions.get(key);
  }

  hasAction(key: string): boolean {
    return this.actions.has(key);
  }

  hasOutcome(key: string): boolean {
    return this.outcomes.has(key);
  }

  outcome(key: string): SectOutcomeContribution | undefined {
    return this.outcomes.get(key);
  }

  decode(outcome: SectTaskActionOutcome): SectOutcomeDecodeResult {
    const contribution = this.outcomes.get(outcome.renderer);
    if (!contribution)
      return { ok: false, error: `暂不支持此任务结果：${outcome.renderer}` };
    const parsed = contribution.schema.safeParse(outcome.data);
    if (!parsed.success)
      return { ok: false, error: `宗门任务结果格式无效：${outcome.renderer}` };
    return {
      ok: true,
      value: { renderer: outcome.renderer, data: parsed.data },
    };
  }
}
