import type { SectPresentationTheme } from '../../core';
import { LINGXIAO_SECT_ID } from './ids';

export const LINGXIAO_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: LINGXIAO_SECT_ID,
  map: {
    image: '/assets/sect/lingxiao-map.webp',
    alt: '凌霄剑宗群峰、楼阁、灵脉矿场与药田的水墨鸟瞰图',
    hotspots: [
      {
        id: 'hall',
        label: '宗门大殿',
        route: '/game/sect/hall',
        permission: 'sect.hall.view',
        left: '46%',
        top: '25%',
        note: '身份 · 晋升 · 周俸',
      },
      {
        id: 'archive',
        label: '藏经阁',
        route: '/game/sect/archive',
        facility: 'archive',
        permission: 'sect.archive.use',
        left: '15%',
        top: '31%',
        note: '心法研习',
      },
      {
        id: 'cliff',
        label: '悟道崖',
        route: '/game/sect/enlightenment-cliff',
        permission: 'sect.enlightenment.use',
        left: '88%',
        top: '19%',
        note: '流派 · 经脉',
      },
      {
        id: 'arena',
        label: '演武台',
        route: '/game/sect/arena',
        permission: 'sect.arena.use',
        left: '57%',
        top: '64%',
        note: '神通 · 战术',
      },
      {
        id: 'affairs',
        label: '执事堂',
        route: '/game/sect/affairs',
        permission: 'sect.tasks.use',
        left: '42%',
        top: '48%',
        note: '日常 · 周常 · 悬赏',
      },
      {
        id: 'treasury',
        label: '宗门宝库',
        route: '/game/sect/treasury',
        permission: 'sect.shop.use',
        left: '57%',
        top: '36%',
        note: '贡献兑换',
      },
      {
        id: 'industries',
        label: '百业院',
        route: '/game/sect/industries',
        permission: 'sect.construction.view',
        left: '55%',
        top: '53%',
        note: '宗门共建',
      },
      {
        id: 'cultivation',
        label: '修炼室',
        route: '/game/sect/cultivation-room',
        facility: 'cultivation_room',
        permission: 'sect.facility.cultivation.use',
        left: '17%',
        top: '72%',
        note: '聚灵闭关',
      },
      {
        id: 'alchemy',
        label: '丹房',
        route: '/game/sect/alchemy',
        facility: 'workshop',
        permission: 'sect.facility.alchemy.use',
        left: '64%',
        top: '43%',
        note: '丹火炼药',
      },
      {
        id: 'refinery',
        label: '器坊',
        route: '/game/sect/refinery',
        facility: 'workshop',
        permission: 'sect.facility.refinery.use',
        left: '69%',
        top: '51%',
        note: '地火铸器',
      },
      {
        id: 'vein',
        label: '灵脉矿场',
        route: '/game/sect/spirit-vein',
        facility: 'spirit_vein',
        permission: 'sect.spirit_vein.view',
        left: '84%',
        top: '46%',
        note: '灵石俸禄加成',
      },
      {
        id: 'garden',
        label: '药田',
        route: '/game/sect/herb-garden',
        facility: 'herb_garden',
        permission: 'sect.herb_garden.view',
        left: '83%',
        top: '75%',
        note: '每周灵草产出',
      },
      {
        id: 'gate',
        label: '山门',
        route: '/game/sect/gate',
        permission: 'sect.gate.view',
        left: '48%',
        top: '77%',
        note: '宗门动态',
      },
      {
        id: 'cave',
        label: '私人洞府',
        route: '/game/sect/cave',
        permission: 'sect.cave.view',
        left: '26%',
        top: '66%',
        note: '内门弟子居所',
      },
      {
        id: 'formation',
        label: '护山大阵',
        facility: 'formation',
        permission: 'sect.formation.view',
        left: '49%',
        top: '8%',
        note: '宗门战后续开放',
        locked: true,
      },
    ],
  },
  facilityLabels: {
    archive: '藏经阁',
    cultivation_room: '修炼室',
    workshop: '丹器坊',
    spirit_vein: '灵脉',
    herb_garden: '药田',
    formation: '护山大阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: {
      title: '凌霄剑宗舆图',
      description:
        '云海诸峰各司其职。择一处落下遁光，进入对应设施办理宗门事务。',
      loadingText: '山门云阶渐次显现……',
    },
    hall: {
      title: '宗门大殿',
      description:
        '长阶尽处殿门洞开，身份玉牒、俸禄名册与同门长卷皆由录事在此核验。',
    },
    affairs: {
      title: '执事堂',
      description:
        '木榜上新令墨迹未干，今日差事、周录与晋升试炼各有封签；择下一令，便不可在当日更换。',
      loadingText: '执事正整理今日委托……',
    },
    archive: {
      title: '藏经阁',
      description:
        '檀木长架沿墙而立，心法卷轴依传承次第展开；在此逐卷研习，不必再穿行别阁。',
      loadingText: '藏经阁卷帙正在归架……',
    },
    paths: {
      title: '悟道崖',
      description:
        '罡风掠过历代剑痕，每一道石刻皆通向不同道途；择定流派后，沿经脉继续参悟。',
      loadingText: '崖间云气正在散开……',
    },
    arena: {
      title: '演武台',
      description:
        '演武场中央阵纹已启，宗门神通将在当前流派与参悟方案下显化威能。',
      loadingText: '演武台阵纹徐徐亮起……',
    },
    treasury: {
      title: '宗门宝库',
      description:
        '铜锁开启，木架深处的常备物资与本周珍材依次显露；持弟子令牌即可按贡献支取。',
      loadingText: '宝库执事正在清点本周库存……',
    },
    industries: {
      title: '百业院',
      description:
        '梁木、阵图与工程长卷铺满案台，长老已圈定本周工事；宗门所需物资皆按清单入册。',
      loadingText: '百业院正在汇总建设账册……',
    },
    cultivation: {
      title: '修炼室',
      description:
        '聚灵阵纹绕蒲团缓缓流转，静香已燃；定下闭关年数，宗门灵气会在结算时自然汇入。',
      loadingText: '聚灵阵正在汇拢灵气……',
    },
    alchemy: {
      title: '丹房',
      description:
        '赤铜丹炉吞吐灵焰，药柜沿墙依性归置；投下灵材、定住丹意，便可在此守候成丹。',
      loadingText: '丹房灵焰正在温炉……',
    },
    refinery: {
      title: '器坊',
      description:
        '地火自山腹引入锻台，冷铁与灵材依次落位；选定器型后即可在此开炉成器。',
      loadingText: '器坊地火正在升温……',
    },
    spiritVein: {
      title: '灵脉矿场',
      description:
        '矿壁间青光沿岩隙缓缓游走，执事循脉定井；每周俸禄中的灵石加成皆从此处汇出。',
      loadingText: '矿道深处灵辉渐明……',
    },
    herbGarden: {
      title: '宗门药田',
      description:
        '层层药畦顺山势铺开，灵泉沿石渠润过根须；成熟灵草将在周俸中交到弟子手中。',
      loadingText: '药田晨雾正在散去……',
    },
    gate: {
      title: '山门',
      description:
        '云阶自群峰之间垂落，守门弟子在晨钟后换过值守；今日宗门内外动静都写在门侧木牌上。',
      loadingText: '山门晨钟穿过云海……',
    },
    cave: {
      title: '私人洞府',
      description:
        '石门隔去峰间喧声，竹影从纸窗落入蒲团；这是内门弟子留在宗门中的一处清修居所。',
      loadingText: '洞府石门映入云间……',
    },
  },
  terms: {
    pathChanges: '剑路变化',
    meridianPractice: '剑道参悟',
    meridianLoadout: '参悟方案',
    abilityChanges: '神通变化',
    returnToAffairs: '返回执事堂',
    sweepActivity: '云阶扫叶',
    sweepCanvasLabel: '云阶扫叶游戏画布',
  },
};
