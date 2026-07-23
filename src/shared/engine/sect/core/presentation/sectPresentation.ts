import type { NarrativePerformanceScript } from '@shared/types/narrative';
import type { SectCapabilityKey } from '../organization/contracts';

export type SectSceneKey =
  | 'map'
  | 'hall'
  | 'affairs'
  | 'archive'
  | 'paths'
  | 'arena'
  | 'treasury'
  | 'industries'
  | 'cultivation'
  | 'alchemy'
  | 'refinery'
  | 'spiritVein'
  | 'herbGarden'
  | 'gate'
  | 'cave'
  | 'taskBattle';

export interface SectMapHotspot {
  id: string;
  label: string;
  route?: string;
  facility?: string;
  permission?: SectCapabilityKey;
  left: string;
  top: string;
  note: string;
  locked?: boolean;
  visitor?: {
    description: string;
  };
}

export interface SectScenePresentation {
  title: string;
  description: string;
  loadingText: string;
  permissionDeniedDescription: string;
}

export interface SectPresentationTerms {
  pathChanges: string;
  meridianPractice: string;
  meridianLoadout: string;
  abilityChanges: string;
  returnToAffairs: string;
  sweepActivity: string;
  sweepCanvasLabel: string;
}

export interface SectPresentationTheme {
  sectId: string;
  onboarding?: {
    summary: string;
    traits: readonly [string, string, string];
    script: NarrativePerformanceScript;
  };
  map?: {
    image?: string;
    alt?: string;
    hotspots?: readonly SectMapHotspot[];
  };
  facilityLabels?: Readonly<Record<string, string>>;
  lockedFacilities?: readonly string[];
  scenes?: Partial<Record<SectSceneKey, Partial<SectScenePresentation>>>;
  terms?: Partial<SectPresentationTerms>;
}

export interface ResolvedSectPresentation {
  sectId: string;
  onboarding?: SectPresentationTheme['onboarding'];
  map: {
    image?: string;
    alt: string;
    hotspots: readonly SectMapHotspot[];
  };
  facilityLabels: Readonly<Record<string, string>>;
  lockedFacilities: readonly string[];
  scenes: Readonly<Record<SectSceneKey, SectScenePresentation>>;
  terms: Readonly<SectPresentationTerms>;
}

const permissionDeniedDescription =
  '设施禁制尚未开启，当前弟子身份不足以进入。';

const scene = (
  title: string,
  description: string,
  loadingText: string,
): SectScenePresentation => ({
  title,
  description,
  loadingText,
  permissionDeniedDescription,
});

const STANDARD_HOTSPOTS: readonly SectMapHotspot[] = [
  {
    id: 'hall',
    label: '宗门大殿',
    route: '/game/sect/hall',
    permission: 'sect.hall.view',
    left: '0',
    top: '0',
    note: '身份、晋升与周俸',
  },
  {
    id: 'archive',
    label: '传承阁',
    route: '/game/sect/archive',
    facility: 'archive',
    permission: 'sect.archive.use',
    left: '0',
    top: '0',
    note: '心法研习',
  },
  {
    id: 'paths',
    label: '悟道处',
    route: '/game/sect/enlightenment-cliff',
    permission: 'sect.enlightenment.use',
    left: '0',
    top: '0',
    note: '流派与参悟',
  },
  {
    id: 'arena',
    label: '演武场',
    route: '/game/sect/arena',
    permission: 'sect.arena.use',
    left: '0',
    top: '0',
    note: '神通与战术',
  },
  {
    id: 'affairs',
    label: '事务堂',
    route: '/game/sect/affairs',
    permission: 'sect.tasks.use',
    left: '0',
    top: '0',
    note: '日常、周常与悬赏',
  },
  {
    id: 'treasury',
    label: '宗门宝库',
    route: '/game/sect/treasury',
    permission: 'sect.shop.use',
    left: '0',
    top: '0',
    note: '贡献兑换',
  },
  {
    id: 'industries',
    label: '建设院',
    route: '/game/sect/industries',
    permission: 'sect.construction.view',
    left: '0',
    top: '0',
    note: '宗门共建',
  },
  {
    id: 'cultivation',
    label: '修炼室',
    route: '/game/sect/cultivation-room',
    facility: 'cultivation_room',
    permission: 'sect.facility.cultivation.use',
    left: '0',
    top: '0',
    note: '聚灵闭关',
  },
  {
    id: 'alchemy',
    label: '丹房',
    route: '/game/sect/alchemy',
    facility: 'workshop',
    permission: 'sect.facility.alchemy.use',
    left: '0',
    top: '0',
    note: '炼制丹药',
  },
  {
    id: 'refinery',
    label: '器坊',
    route: '/game/sect/refinery',
    facility: 'workshop',
    permission: 'sect.facility.refinery.use',
    left: '0',
    top: '0',
    note: '炼制法器',
  },
  {
    id: 'vein',
    label: '灵脉',
    route: '/game/sect/spirit-vein',
    facility: 'spirit_vein',
    permission: 'sect.spirit_vein.view',
    left: '0',
    top: '0',
    note: '俸禄加成',
  },
  {
    id: 'garden',
    label: '药田',
    route: '/game/sect/herb-garden',
    facility: 'herb_garden',
    permission: 'sect.herb_garden.view',
    left: '0',
    top: '0',
    note: '每周灵草产出',
  },
  {
    id: 'gate',
    label: '山门',
    route: '/game/sect/gate',
    permission: 'sect.gate.view',
    left: '0',
    top: '0',
    note: '宗门动态',
  },
  {
    id: 'cave',
    label: '弟子居所',
    route: '/game/sect/cave',
    permission: 'sect.cave.view',
    left: '0',
    top: '0',
    note: '弟子居所',
  },
];

const STANDARD_SCENES: Record<SectSceneKey, SectScenePresentation> = {
  map: scene(
    '宗门舆图',
    '宗门设施各司其职，可从此进入对应场所。',
    '宗门舆图正在展开……',
  ),
  hall: scene(
    '宗门大殿',
    '身份、俸禄、晋升与同门名册均在此查验。',
    '身份玉牒正在核验……',
  ),
  affairs: scene(
    '事务堂',
    '宗门日常、周常与晋升事务均在此领取和交付。',
    '事务目录正在整理……',
  ),
  archive: scene(
    '传承阁',
    '宗门心法依传承次第收录，可在此逐卷研习。',
    '传承卷册正在归档……',
  ),
  paths: scene(
    '悟道处',
    '选择流派，并为已解锁层级配置参悟节点。',
    '参悟记录正在展开……',
  ),
  arena: scene(
    '演武场',
    '配置已解锁神通与自动战术，检视当前构筑效果。',
    '演武阵法正在开启……',
  ),
  treasury: scene(
    '宗门宝库',
    '使用宗门贡献兑换常备物资与轮换珍材。',
    '宝库库存正在清点……',
  ),
  industries: scene(
    '建设院',
    '提交公共工程所需物资，推进宗门设施建设。',
    '建设账册正在汇总……',
  ),
  cultivation: scene(
    '修炼室',
    '使用宗门修炼设施进行闭关。',
    '聚灵设施正在启动……',
  ),
  alchemy: scene('丹房', '使用宗门丹房炼制丹药。', '炼丹设施正在启动……'),
  refinery: scene('器坊', '使用宗门器坊炼制法器。', '炼器设施正在启动……'),
  spiritVein: scene(
    '灵脉',
    '查看灵脉设施为宗门收益提供的加成。',
    '灵脉记录正在读取……',
  ),
  herbGarden: scene(
    '药田',
    '查看药田设施提供的周期产出。',
    '药田记录正在读取……',
  ),
  gate: scene('山门', '查看宗门近期动态与公共事务。', '山门记录正在读取……'),
  cave: scene(
    '弟子居所',
    '查看你在宗门中的个人居所资格。',
    '居所记录正在读取……',
  ),
  taskBattle: scene('宗门战局', '完成当前宗门战斗事务。', '宗门战局推演中……'),
};

export const STANDARD_SECT_PRESENTATION: Omit<
  ResolvedSectPresentation,
  'sectId'
> = Object.freeze({
  map: Object.freeze({
    alt: '宗门设施导航图',
    hotspots: STANDARD_HOTSPOTS,
  }),
  facilityLabels: Object.freeze({
    archive: '传承阁',
    cultivation_room: '修炼室',
    workshop: '丹器坊',
    spirit_vein: '灵脉',
    herb_garden: '药田',
    formation: '护宗大阵',
  }),
  lockedFacilities: Object.freeze(['formation']),
  scenes: Object.freeze(STANDARD_SCENES),
  terms: Object.freeze({
    pathChanges: '流派变化',
    meridianPractice: '参悟进度',
    meridianLoadout: '参悟方案',
    abilityChanges: '神通变化',
    returnToAffairs: '返回事务堂',
    sweepActivity: '宗门勤务',
    sweepCanvasLabel: '宗门勤务游戏画布',
  }),
});

function assertNonBlank(label: string, value: string): void {
  if (!value.trim()) throw new Error(`${label}不能为空`);
}

export function resolveSectPresentation(
  sectId: string,
  theme?: SectPresentationTheme,
): ResolvedSectPresentation {
  if (theme && theme.sectId !== sectId) {
    throw new Error(`宗门展示主题标识不一致：${theme.sectId} !== ${sectId}`);
  }
  const scenes = Object.fromEntries(
    (Object.keys(STANDARD_SECT_PRESENTATION.scenes) as SectSceneKey[]).map(
      (key) => [
        key,
        { ...STANDARD_SECT_PRESENTATION.scenes[key], ...theme?.scenes?.[key] },
      ],
    ),
  ) as Record<SectSceneKey, SectScenePresentation>;
  const map = {
    ...STANDARD_SECT_PRESENTATION.map,
    ...theme?.map,
    hotspots: theme?.map?.hotspots ?? STANDARD_SECT_PRESENTATION.map.hotspots,
  };
  const resolved: ResolvedSectPresentation = {
    sectId,
    onboarding: theme?.onboarding,
    map,
    facilityLabels: {
      ...STANDARD_SECT_PRESENTATION.facilityLabels,
      ...theme?.facilityLabels,
    },
    lockedFacilities:
      theme?.lockedFacilities ?? STANDARD_SECT_PRESENTATION.lockedFacilities,
    scenes,
    terms: { ...STANDARD_SECT_PRESENTATION.terms, ...theme?.terms },
  };

  for (const [key, value] of Object.entries(resolved.facilityLabels)) {
    assertNonBlank(`宗门 ${sectId} 设施 ${key} 名称`, value);
  }
  for (const [key, value] of Object.entries(resolved.scenes)) {
    for (const [field, text] of Object.entries(value)) {
      assertNonBlank(`宗门 ${sectId} 场景 ${key}.${field}`, text);
    }
  }
  for (const [key, value] of Object.entries(resolved.terms)) {
    assertNonBlank(`宗门 ${sectId} 术语 ${key}`, value);
  }
  for (const facility of resolved.lockedFacilities) {
    assertNonBlank(`宗门 ${sectId} 锁定设施`, facility);
  }
  if (theme?.map?.image !== undefined) {
    assertNonBlank(`宗门 ${sectId} 地图资源`, theme.map.image);
  }
  if (resolved.onboarding) {
    assertNonBlank(`宗门 ${sectId} 入门摘要`, resolved.onboarding.summary);
    resolved.onboarding.traits.forEach((trait, index) =>
      assertNonBlank(`宗门 ${sectId} 入门特色 ${index}`, trait),
    );
    assertNonBlank(`宗门 ${sectId} 演出标识`, resolved.onboarding.script.id);
    assertNonBlank(`宗门 ${sectId} 演出标题`, resolved.onboarding.script.title);
    assertNonBlank(
      `宗门 ${sectId} 演出背景`,
      resolved.onboarding.script.backdrop.src,
    );
    assertNonBlank(
      `宗门 ${sectId} 演出背景替代文本`,
      resolved.onboarding.script.backdrop.alt,
    );
    if (!resolved.onboarding.script.acts.length) {
      throw new Error(`宗门 ${sectId} 入门演出至少需要一幕`);
    }
    for (const act of resolved.onboarding.script.acts) {
      assertNonBlank(`宗门 ${sectId} 演出幕标识`, act.id);
      assertNonBlank(`宗门 ${sectId} 演出幕名`, act.title);
      assertNonBlank(`宗门 ${sectId} 演出场景`, act.scene);
      assertNonBlank(`宗门 ${sectId} 演出正文`, act.body);
    }
  }
  if (theme?.map?.alt !== undefined) {
    assertNonBlank(`宗门 ${sectId} 地图替代文本`, theme.map.alt);
  }
  if (map.image) {
    if (!theme?.map?.alt?.trim() || !theme.map.hotspots?.length) {
      throw new Error(`宗门 ${sectId} 自定义地图必须提供完整热点配置`);
    }
  }
  for (const hotspot of map.hotspots) {
    assertNonBlank(`宗门 ${sectId} 地图热点 ID`, hotspot.id);
    assertNonBlank(`宗门 ${sectId} 地图热点名称`, hotspot.label);
    assertNonBlank(`宗门 ${sectId} 地图热点说明`, hotspot.note);
    assertNonBlank(`宗门 ${sectId} 地图热点横坐标`, hotspot.left);
    assertNonBlank(`宗门 ${sectId} 地图热点纵坐标`, hotspot.top);
    if (hotspot.route !== undefined) {
      assertNonBlank(`宗门 ${sectId} 地图热点路由`, hotspot.route);
    }
    if (hotspot.facility !== undefined) {
      assertNonBlank(`宗门 ${sectId} 地图热点设施`, hotspot.facility);
    }
  }
  if (
    new Set(map.hotspots.map((hotspot) => hotspot.id)).size !==
    map.hotspots.length
  ) {
    throw new Error(`宗门 ${sectId} 地图热点 ID 不可重复`);
  }
  return resolved;
}
