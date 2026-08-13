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

export type SectAffairsTaskKind = 'daily' | 'weekly' | 'promotion';
export type SectRoomActorAppearance = 'person' | 'facility';

export interface SectRoomNpcPresentation {
  id: string;
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  greeting: string;
  appearance: SectRoomActorAppearance;
}

export interface SectRoomConversationDefinition {
  renderer: string;
  parameters?: Readonly<Record<string, unknown>>;
}

export interface SectRoomActorDefinition extends SectRoomNpcPresentation {
  roleKey: string;
  conversation: SectRoomConversationDefinition;
}

export interface SectRoomDefinition {
  key: string;
  description: string;
  actors: readonly SectRoomActorDefinition[];
}

export interface SectRoomThemeOverride {
  description?: string;
  actors?: Readonly<
    Record<
      string,
      Partial<Pick<SectRoomActorDefinition, 'id' | 'name' | 'greeting'>>
    >
  >;
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
  announcement: string;
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
  rooms?: Readonly<Record<string, SectRoomThemeOverride>>;
  terms?: Partial<
    Omit<SectPresentationTerms, 'sweepActivity' | 'sweepCanvasLabel'>
  >;
}

export interface ResolvedSectPresentation {
  sectId: string;
  announcement: string;
  onboarding?: SectPresentationTheme['onboarding'];
  map: {
    image?: string;
    alt: string;
    hotspots: readonly SectMapHotspot[];
  };
  facilityLabels: Readonly<Record<string, string>>;
  lockedFacilities: readonly string[];
  scenes: Readonly<Record<SectSceneKey, SectScenePresentation>>;
  rooms: Readonly<Record<string, SectRoomDefinition>>;
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
    note: '身份 · 同门 · 周俸',
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
    note: '流派 · 参悟',
  },
  {
    id: 'arena',
    label: '演武场',
    route: '/game/sect/arena',
    permission: 'sect.arena.use',
    left: '0',
    top: '0',
    note: '神通 · 战术 · 小比',
  },
  {
    id: 'affairs',
    label: '事务堂',
    route: '/game/sect/affairs',
    permission: 'sect.tasks.use',
    left: '0',
    top: '0',
    note: '日常 · 周常 · 晋升',
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
    note: '设施建设 · 灵石捐献',
  },
  {
    id: 'cultivation',
    label: '修炼室',
    route: '/game/sect/cultivation-room',
    facility: 'cultivation_room',
    permission: 'sect.facility.cultivation.use',
    left: '0',
    top: '0',
    note: '闭关修炼 · 设施灵效',
  },
  {
    id: 'alchemy',
    label: '丹房',
    route: '/game/sect/alchemy',
    facility: 'workshop',
    permission: 'sect.facility.alchemy.use',
    left: '0',
    top: '0',
    note: '炼丹 · 设施灵效',
  },
  {
    id: 'refinery',
    label: '器坊',
    route: '/game/sect/refinery',
    facility: 'workshop',
    permission: 'sect.facility.refinery.use',
    left: '0',
    top: '0',
    note: '炼器 · 设施灵效',
  },
  {
    id: 'vein',
    label: '灵脉',
    route: '/game/sect/spirit-vein',
    facility: 'spirit_vein',
    permission: 'sect.spirit_vein.view',
    left: '0',
    top: '0',
    note: '矿场巡视 · 灵石收益 · 采矿',
  },
  {
    id: 'garden',
    label: '药田',
    route: '/game/sect/herb-garden',
    facility: 'herb_garden',
    permission: 'sect.herb_garden.view',
    left: '0',
    top: '0',
    note: '草木长势 · 产出待开放',
  },
  {
    id: 'gate',
    label: '山门',
    route: '/game/sect/gate',
    permission: 'sect.gate.view',
    left: '0',
    top: '0',
    note: '山门动态 · 清扫差事',
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
    '选择宗门设施并捐献灵石，推进常态建设。',
    '设施建设进度正在汇总……',
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
    '查看灵脉设施收益并办理矿场事务。',
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

const roomActor = (
  roleKey: string,
  sigil: string,
  name: string,
  identity: string,
  responsibility: string,
  greeting: string,
  renderer: string,
  parameters?: Readonly<Record<string, unknown>>,
  id = roleKey,
  appearance: SectRoomActorAppearance = 'person',
): SectRoomActorDefinition => ({
  roleKey,
  id,
  sigil,
  name,
  identity,
  responsibility,
  greeting,
  appearance,
  conversation: { renderer, parameters },
});

const STANDARD_ROOMS: Readonly<Record<string, SectRoomDefinition>> =
  Object.freeze({
    affairs: {
      key: 'affairs',
      description:
        '堂中卷宗分由三席执事经办。寻到对应执事，便可询问、接办或交回当前事务。',
      actors: [
        roomActor(
          'daily',
          '执',
          '值日执事',
          '值日执事',
          '负责日常委托。',
          '今日事务都在这里。你要先看哪一件？',
          'sect.affairs.tasks',
          { kind: 'daily' satisfies SectAffairsTaskKind },
          'daily-steward',
        ),
        roomActor(
          'weekly',
          '簿',
          '功簿执事',
          '功簿执事',
          '负责周常委托。',
          '本周卷宗已经归拢，你可逐项查验。',
          'sect.affairs.tasks',
          { kind: 'weekly' satisfies SectAffairsTaskKind },
          'weekly-steward',
        ),
        roomActor(
          'promotion',
          '传',
          '传功长老',
          '传功长老',
          '负责晋升试炼。',
          '晋升不可躁进。先看看你当前应过的关。',
          'sect.affairs.tasks',
          { kind: 'promotion' satisfies SectAffairsTaskKind },
          'promotion-elder',
        ),
      ],
    },
    hall: {
      key: 'hall',
      description: '玉牒、俸册与同门名录分案收存。寻到对应执事，便可当面查验。',
      actors: [
        roomActor(
          'registry',
          '掌',
          '掌籍执事',
          '掌籍执事',
          '负责弟子身份与同门名录。',
          '身份玉牒与同门名录都在这里，你想查哪一项？',
          'sect.hall.registry',
        ),
        roomActor(
          'stipend',
          '俸',
          '俸禄执事',
          '俸禄执事',
          '负责核算和发放宗门周俸。',
          '本周俸册已经核清，你可来查验或领取。',
          'sect.hall.stipend',
        ),
      ],
    },
    treasury: {
      key: 'treasury',
      description: '库架依次封存常备物资与轮换珍材，司库执事正在案前清点。',
      actors: [
        roomActor(
          'keeper',
          '库',
          '司库执事',
          '司库执事',
          '负责宝库库存与贡献兑换。',
          '宝库今日已经开封。你想查看哪一类物资？',
          'sect.treasury.shop',
        ),
      ],
    },
    industries: {
      key: 'industries',
      description: '各处设施的等级与进度列于案前，宗门建设由两席执事共同经办。',
      actors: [
        roomActor(
          'construction',
          '造',
          '营造执事',
          '营造执事',
          '负责各处设施等级与建设进度。',
          '各处设施的建设进度都有记录，可以随时查验。',
          'sect.industries.construction',
        ),
        roomActor(
          'donation',
          '石',
          '建设执事',
          '建设执事',
          '负责灵石捐献与建设登记。',
          '每日可择一处设施捐献灵石，你想建设哪一处？',
          'sect.industries.donation',
        ),
      ],
    },
    archive: {
      key: 'archive',
      description: '传承经卷依次归架，守阁之人静候案前，为弟子查卷授业。',
      actors: [
        roomActor(
          'keeper',
          '阁',
          '守阁长老',
          '守阁长老',
          '负责心法经卷与研习。',
          '阁中经卷各有次第，你想研习哪一门心法？',
          'sect.archive.methods',
        ),
      ],
    },
    paths: {
      key: 'paths',
      description: '道痕在静处交汇，引道长老在此为弟子辨明流派与参悟次第。',
      actors: [
        roomActor(
          'guide',
          '引',
          '引道长老',
          '引道长老',
          '负责流派选择与参悟引导。',
          '道途不可只看名目。你想从哪一脉开始问？',
          'sect.paths.guidance',
        ),
      ],
    },
    arena: {
      key: 'arena',
      description:
        '演武阵纹铺陈场中，教习与值场执事分守两侧，宗门擂台立在中央。',
      actors: [
        roomActor(
          'instructor',
          '武',
          '演武教习',
          '演武教习',
          '负责神通配置与自动战术。',
          '你的神通与战术都可在此调整，想先看哪一项？',
          'sect.arena.loadout',
        ),
        roomActor(
          'marshal',
          '场',
          '值场执事',
          '值场执事',
          '负责演武场秩序与入场引导。',
          '演武场已经清过场，小比对手会在宗门擂台前候场。',
          'sect.arena.marshal',
        ),
        roomActor(
          'ring',
          '⚔️',
          '宗门擂台',
          '宗门设施',
          '开启宗门小比战局。',
          '擂台阵纹已归位，有小比在身便可登台。',
          'sect.arena.tournament',
          { locationKey: 'sect.arena' },
          'sect-arena-ring',
          'facility',
        ),
      ],
    },
    cultivation: {
      key: 'cultivation',
      description: '聚灵阵息在静室中缓缓流转，守阵执事候在阵枢旁。',
      actors: [
        roomActor(
          'keeper',
          '阵',
          '守阵执事',
          '守阵执事',
          '负责聚灵阵与闭关安排。',
          '阵息平稳。你要查问此地灵效，还是就此入静？',
          'sect.cultivation.retreat',
        ),
      ],
    },
    alchemy: {
      key: 'alchemy',
      description: '丹炉灵焰未熄，药柜依次封存。丹房执事正在炉前值守。',
      actors: [
        roomActor(
          'keeper',
          '丹',
          '丹房执事',
          '丹房执事',
          '负责丹房状态与炼丹安排。',
          '炉火正稳。你要先问丹房灵效，还是直接开炉？',
          'sect.alchemy.craft',
          {
            facilityKey: 'workshop',
            effectKey: 'alchemy',
            workspaceHref: '/game/sect/alchemy?workspace=craft',
            statusReply: '请执事说说丹房灵效',
            workspaceReply: '有劳执事为我开炉炼丹',
          },
        ),
        roomActor(
          'furnace',
          '鼎',
          '宗门丹炉',
          '炼丹设施',
          '纳药、引火、聚蕴、凝丹。',
          '炉腹传来低沉回响，地火阵纹正等待灵石与药气。',
          'sect.alchemy.craft',
          {
            facilityKey: 'workshop',
            effectKey: 'alchemy',
            workspaceHref: '/game/sect/alchemy?workspace=craft',
            statusReply: '以神识察看丹炉灵效',
            workspaceReply: '唤醒丹炉，开始炼丹',
          },
          'sect-alchemy-furnace',
          'facility',
        ),
      ],
    },
    refinery: {
      key: 'refinery',
      description: '地火沿炉道升起，锻台已经清空。器坊执事守在火口旁。',
      actors: [
        roomActor(
          'keeper',
          '器',
          '器坊执事',
          '器坊执事',
          '负责器坊状态与炼器安排。',
          '地火可用。你要先问器坊灵效，还是就此开炉？',
          'sect.refinery.craft',
          {
            facilityKey: 'workshop',
            effectKey: 'refinery',
            workspaceHref: '/game/sect/refinery?workspace=craft',
            statusReply: '请执事说说器坊灵效',
            workspaceReply: '有劳执事为我开炉炼器',
          },
        ),
      ],
    },
    spiritVein: {
      key: 'spiritVein',
      description: '矿道灵辉沿岩隙流转，守脉执事在井口整理今日的巡视封签。',
      actors: [
        roomActor(
          'keeper',
          '脉',
          '守脉执事',
          '守脉执事',
          '负责矿场巡视交接。',
          '今日巡视封签已经备好，你若领了矿场差事便来核对。',
          'sect.spirit-vein.patrol',
          {
            locationKey: 'sect.spirit-vein',
          },
        ),
        roomActor(
          'facility',
          '⛏️',
          '宗门灵脉',
          '宗门设施',
          '查看设施等级、灵石收益并进行灵矿采掘。',
          '矿壁中的灵辉依旧沿岩隙缓缓流转。',
          'sect.spirit-vein.mining',
          {
            facilityKey: 'spirit_vein',
            effectKey: 'spirit_vein',
            detail: '灵石收益会随周俸一并核算，无需在矿场另行采收。',
          },
          'spirit-vein-facility',
          'facility',
        ),
      ],
    },
    herbGarden: {
      key: 'herbGarden',
      description: '灵泉沿畦垄缓缓流过，药园执事正在田边查验草木长势。',
      actors: [
        roomActor(
          'keeper',
          '药',
          '药园执事',
          '药园执事',
          '负责草木长势与周期产出。',
          '今日草木长势平稳，田间近况都已记在值录中。',
          'sect.herb-garden.caretaker',
          {
            facilityKey: 'herb_garden',
            detail: '药田产出玩法后续开放。',
            stages: [
              '新畦初醒',
              '灵苗成行',
              '药香盈陌',
              '四时不歇',
              '百草丰登',
            ],
          },
        ),
        roomActor(
          'facility',
          '🌿',
          '宗门药田',
          '宗门设施',
          '查看设施等级与药田近况。',
          '灵泉润过畦垄，草木依照时序生长。',
          'sect.herb-garden.status',
          {
            facilityKey: 'herb_garden',
            effectKey: 'herb_garden',
            detail: '药田产出玩法后续开放。',
          },
          'herb-garden-facility',
          'facility',
        ),
      ],
    },
    gate: {
      key: 'gate',
      description: '山门内外人声往来，守山执事在门侧整理当日来往记录。',
      actors: [
        roomActor(
          'keeper',
          '门',
          '守山执事',
          '守山执事',
          '负责山门动态与来往记录。',
          '今日来往记录已经理清，山门内外的动静都可查问。',
          'sect.gate.news',
        ),
        roomActor(
          'facility',
          '⛰️',
          '宗门山门',
          '宗门设施',
          '进入山门步道完成清扫。',
          '门前石阶延入山道，零落枝叶仍待清理。',
          'sect.gate.sweep',
          undefined,
          'gate-facility',
          'facility',
        ),
      ],
    },
    formation: {
      key: 'formation',
      description: '护宗阵枢仍在封禁之中。',
      actors: [
        roomActor(
          'warden',
          '护',
          '护阵长老',
          '护阵长老',
          '负责护宗阵法管理。',
          '阵枢尚未开放，今日无需入内。',
          'sect.formation.status',
        ),
      ],
    },
  });

export const STANDARD_SECT_PRESENTATION: Omit<
  ResolvedSectPresentation,
  'sectId'
> = Object.freeze({
  announcement: '宗门诸务照常运转，请诸位弟子各安其位、勤勉修行。',
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
  rooms: STANDARD_ROOMS,
  terms: Object.freeze({
    pathChanges: '流派变化',
    meridianPractice: '参悟进度',
    meridianLoadout: '参悟方案',
    abilityChanges: '神通变化',
    returnToAffairs: '返回事务堂',
    sweepActivity: '清扫山门',
    sweepCanvasLabel: '清扫山门游戏画布',
  }),
});

function assertNonBlank(label: string, value: string): void {
  if (!value.trim()) throw new Error(`${label}不能为空`);
}

export function resolveSectPresentation(
  sectId: string,
  theme?: Omit<SectPresentationTheme, 'announcement'> & {
    announcement?: string;
  },
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
  const rooms = Object.fromEntries(
    Object.entries(STANDARD_SECT_PRESENTATION.rooms).map(
      ([roomKey, standardRoom]) => {
        const roomOverride = theme?.rooms?.[roomKey];
        const actors = standardRoom.actors.map((standardActor) => {
          const override = roomOverride?.actors?.[standardActor.roleKey];
          return {
            ...standardActor,
            id: override?.id ?? standardActor.id,
            name: override?.name ?? standardActor.name,
            greeting: override?.greeting ?? standardActor.greeting,
          };
        });
        return [
          roomKey,
          {
            ...standardRoom,
            description: roomOverride?.description ?? standardRoom.description,
            actors,
          },
        ];
      },
    ),
  ) as Record<string, SectRoomDefinition>;
  const resolved: ResolvedSectPresentation = {
    sectId,
    announcement:
      theme?.announcement ?? STANDARD_SECT_PRESENTATION.announcement,
    onboarding: theme?.onboarding,
    map,
    facilityLabels: {
      ...STANDARD_SECT_PRESENTATION.facilityLabels,
      ...theme?.facilityLabels,
    },
    lockedFacilities:
      theme?.lockedFacilities ?? STANDARD_SECT_PRESENTATION.lockedFacilities,
    scenes,
    rooms,
    terms: {
      ...STANDARD_SECT_PRESENTATION.terms,
      ...theme?.terms,
      sweepActivity: STANDARD_SECT_PRESENTATION.terms.sweepActivity,
      sweepCanvasLabel: STANDARD_SECT_PRESENTATION.terms.sweepCanvasLabel,
    },
  };

  assertNonBlank(`宗门 ${sectId} 公告`, resolved.announcement);
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
  for (const [roomKey, room] of Object.entries(resolved.rooms)) {
    assertNonBlank(`宗门 ${sectId} 房间 ${roomKey}.key`, room.key);
    assertNonBlank(
      `宗门 ${sectId} 房间 ${roomKey}.description`,
      room.description,
    );
    const actorIds = new Set<string>();
    const roleKeys = new Set<string>();
    for (const actor of room.actors) {
      if (actor.appearance !== 'person' && actor.appearance !== 'facility')
        throw new Error(
          `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.appearance 无效`,
        );
      for (const field of [
        'roleKey',
        'id',
        'sigil',
        'name',
        'identity',
        'responsibility',
        'greeting',
      ] as const) {
        assertNonBlank(
          `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.${field}`,
          actor[field],
        );
      }
      assertNonBlank(
        `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.renderer`,
        actor.conversation.renderer,
      );
      if (actorIds.has(actor.id))
        throw new Error(`宗门 ${sectId} 房间 ${roomKey} NPC ID 不可重复`);
      if (roleKeys.has(actor.roleKey))
        throw new Error(`宗门 ${sectId} 房间 ${roomKey} 角色标识不可重复`);
      actorIds.add(actor.id);
      roleKeys.add(actor.roleKey);
    }
  }
  for (const [roomKey, override] of Object.entries(theme?.rooms ?? {})) {
    const standard = STANDARD_SECT_PRESENTATION.rooms[roomKey];
    if (!standard) throw new Error(`宗门 ${sectId} 覆盖了未知房间：${roomKey}`);
    const roleKeys = new Set(standard.actors.map((actor) => actor.roleKey));
    for (const roleKey of Object.keys(override.actors ?? {})) {
      if (!roleKeys.has(roleKey))
        throw new Error(
          `宗门 ${sectId} 房间 ${roomKey} 覆盖了未知角色：${roleKey}`,
        );
    }
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
