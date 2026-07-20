import type { SectCapabilityKey } from '@shared/engine/sect';
import type {
  SectTaskActionOutcome,
  SectTaskViewData,
} from '@shared/contracts/sect';
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
  mapImage?: string;
  mapAlt?: string;
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
  renderer: ComponentType<SectOutcomeRendererProps<unknown>>;
}

export interface SectOutcomeRendererProps<T> {
  task: SectTaskViewData;
  data: T;
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
  private readonly outcomes = new Map<string, SectOutcomeContribution>();

  constructor(private readonly knownSectIds: readonly string[]) {}

  register(manifest: SectPresentationPluginManifest): void {
    if (manifest.sectId !== '*' && !this.knownSectIds.includes(manifest.sectId)) {
      throw new Error(`宗门展示插件没有对应内容模块：${manifest.sectId}`);
    }
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
      this.outcomes.set(contribution.key, contribution);
    }
  }

  presentation(sectId: string): SectPresentationModule {
    if (!this.knownSectIds.includes(sectId)) throw new Error(`未知宗门：${sectId}`);
    return this.presentations.get(sectId) ?? createGenericSectPresentation(sectId);
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

const GENERIC_FACILITY_LABELS = {
  archive: '传承阁',
  cultivation_room: '修炼室',
  workshop: '丹器坊',
  spirit_vein: '灵脉',
  herb_garden: '药田',
  formation: '护宗大阵',
} as const;

const GENERIC_HOTSPOTS: readonly SectMapHotspot[] = [
  { id: 'hall', label: '宗门大殿', route: '/game/sect/hall', permission: 'sect.hall.view', left: '0', top: '0', note: '身份、晋升与周俸' },
  { id: 'archive', label: '传承阁', route: '/game/sect/archive', facility: 'archive', permission: 'sect.archive.use', left: '0', top: '0', note: '心法研习' },
  { id: 'enlightenment', label: '悟道处', route: '/game/sect/enlightenment-cliff', permission: 'sect.enlightenment.use', left: '0', top: '0', note: '流派与经脉' },
  { id: 'arena', label: '演武场', route: '/game/sect/arena', permission: 'sect.arena.use', left: '0', top: '0', note: '神通与战术' },
  { id: 'affairs', label: '事务堂', route: '/game/sect/affairs', permission: 'sect.tasks.use', left: '0', top: '0', note: '日常、周常与悬赏' },
  { id: 'treasury', label: '宗门宝库', route: '/game/sect/treasury', permission: 'sect.shop.use', left: '0', top: '0', note: '贡献兑换' },
  { id: 'industries', label: '建设院', route: '/game/sect/industries', permission: 'sect.construction.view', left: '0', top: '0', note: '宗门共建' },
  { id: 'cultivation', label: '修炼室', route: '/game/sect/cultivation-room', facility: 'cultivation_room', permission: 'sect.facility.cultivation.use', left: '0', top: '0', note: '聚灵闭关' },
  { id: 'alchemy', label: '丹房', route: '/game/sect/alchemy', facility: 'workshop', permission: 'sect.facility.alchemy.use', left: '0', top: '0', note: '炼制丹药' },
  { id: 'refinery', label: '器坊', route: '/game/sect/refinery', facility: 'workshop', permission: 'sect.facility.refinery.use', left: '0', top: '0', note: '炼制法器' },
  { id: 'vein', label: '灵脉', route: '/game/sect/spirit-vein', facility: 'spirit_vein', permission: 'sect.spirit_vein.view', left: '0', top: '0', note: '俸禄加成' },
  { id: 'garden', label: '药田', route: '/game/sect/herb-garden', facility: 'herb_garden', permission: 'sect.herb_garden.view', left: '0', top: '0', note: '每周灵草产出' },
  { id: 'gate', label: '山门', route: '/game/sect/gate', permission: 'sect.gate.view', left: '0', top: '0', note: '宗门动态' },
  { id: 'cave', label: '弟子居所', route: '/game/sect/cave', permission: 'sect.cave.view', left: '0', top: '0', note: '内门弟子居所' },
];

function createGenericSectPresentation(sectId: string): SectPresentationModule {
  return {
    sectId,
    facilityLabels: GENERIC_FACILITY_LABELS,
    lockedFacilities: ['formation'],
    hotspots: GENERIC_HOTSPOTS,
  };
}
