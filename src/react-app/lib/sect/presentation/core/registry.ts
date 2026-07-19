import type { SectCapabilityKey } from '@shared/engine/sect';
import type { SectTaskActionOutcome } from '@shared/contracts/sect';
import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { SectTaskActionRendererProps } from '@app/components/feature/sect/SectTaskActions';

export type SectMapHotspot = {
  id: string;
  label: string;
  route?: string;
  facility?: string;
  permission?: SectCapabilityKey;
  left: string;
  top: string;
  note: string;
  locked?: boolean;
};

export interface SectPresentationModule {
  sectId: string;
  mapImage: string;
  mapAlt: string;
  facilityLabels: Readonly<Record<string, string>>;
  lockedFacilities: readonly string[];
  hotspots: readonly SectMapHotspot[];
}

export interface SectActionRendererContribution {
  key: string;
  renderer: ComponentType<SectTaskActionRendererProps>;
}

export interface SectOutcomeContribution<T = unknown> {
  key: string;
  schema: ZodType<T>;
}

export interface SectPresentationPluginManifest {
  sectId: string;
  presentation?: SectPresentationModule;
  actions?: readonly SectActionRendererContribution[];
  outcomes?: readonly SectOutcomeContribution[];
}

export interface DecodedSectTaskOutcome {
  renderer: string;
  data: unknown;
}

export type SectOutcomeDecodeResult =
  | { ok: true; value: DecodedSectTaskOutcome }
  | { ok: false; error: string };

export class SectPresentationRegistry {
  private readonly presentations = new Map<string, SectPresentationModule>();
  private readonly actions = new Map<
    string,
    ComponentType<SectTaskActionRendererProps>
  >();
  private readonly outcomes = new Map<string, ZodType>();

  register(manifest: SectPresentationPluginManifest): void {
    if (manifest.presentation) {
      if (manifest.presentation.sectId !== manifest.sectId)
        throw new Error(`宗门展示插件标识不一致：${manifest.sectId}`);
      if (this.presentations.has(manifest.sectId))
        throw new Error(`宗门展示模块重复注册：${manifest.sectId}`);
      this.presentations.set(manifest.sectId, manifest.presentation);
    }
    for (const contribution of manifest.actions ?? []) {
      if (this.actions.has(contribution.key))
        throw new Error(`宗门任务展示器重复注册：${contribution.key}`);
      this.actions.set(contribution.key, contribution.renderer);
    }
    for (const contribution of manifest.outcomes ?? []) {
      if (this.outcomes.has(contribution.key))
        throw new Error(`宗门任务结果展示器重复注册：${contribution.key}`);
      this.outcomes.set(contribution.key, contribution.schema);
    }
  }

  presentation(sectId: string): SectPresentationModule {
    const presentation = this.presentations.get(sectId);
    if (!presentation) throw new Error(`宗门尚未注册展示模块：${sectId}`);
    return presentation;
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

  decode(outcome: SectTaskActionOutcome): SectOutcomeDecodeResult {
    const schema = this.outcomes.get(outcome.renderer);
    if (!schema)
      return { ok: false, error: `暂不支持此任务结果：${outcome.renderer}` };
    const parsed = schema.safeParse(outcome.data);
    if (!parsed.success)
      return { ok: false, error: `宗门任务结果格式无效：${outcome.renderer}` };
    return {
      ok: true,
      value: { renderer: outcome.renderer, data: parsed.data },
    };
  }
}
