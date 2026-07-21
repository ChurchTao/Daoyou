import type { SectPresentationTheme } from '../../core';
import { LINGXIAO_SECT_ID } from './ids';

export const LINGXIAO_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: LINGXIAO_SECT_ID,
  onboarding: {
    summary:
      '从红尘中学剑，以平生所见养成剑意，在照影游尘与守拙藏锋之间走出自己的剑路。',
    traits: ['入世问剑', '快重由心', '此剑平生'],
    script: {
      id: 'lingxiao-onboarding',
      title: '人间问剑',
      theme: 'steel',
      backdrop: {
        src: '/assets/sect/onboarding/lingxiao.webp',
        alt: '红尘剑宗山门朝向山下城郭，负剑弟子沿石阶往来于山门与人间',
      },
      acts: [
        {
          id: 'downhill-gate',
          title: '山下之门',
          scene: '红尘剑宗 · 山门',
          body: '山门立在半山，门外石阶没有隐入云海，而是一路通向炊烟初起的城郭。有人衣衫整肃，正负剑下山；也有人带着满身风尘，从长路归来。',
          speaker:
            '守门弟子：“上山学剑，下山用剑。红尘剑宗的路，从来要走两遍。”',
          backgroundPosition: '58% 46%',
          tone: 'mist',
        },
        {
          id: 'ask-the-sword',
          title: '先问其剑',
          scene: '红尘剑宗 · 问剑堂',
          body: '传功长老没有命你劈开试剑石，只从旧架上取下一柄寻常铁剑，横放在你面前。剑锋不见灵光，剑鞘上却留着许多经年磨痕。',
          speaker: '传功长老：“剑能斩什么，不难。难的是你要知道，什么不该斩。”',
          backgroundPosition: '30% 52%',
          tone: 'steel',
        },
        {
          id: 'sword-record',
          title: '红尘剑录',
          scene: '红尘剑宗 · 剑录阁',
          body: '旧卷中既有剑招，也夹着地名、人名、残缺书信与未能兑现的约定。许多段落只有寥寥数笔，却被后来者反复翻阅。',
          speaker:
            '守阁长老：“剑法可以传，平生不可照抄。前人的答案，只能替你问出自己的问题。”',
          backgroundPosition: '72% 38%',
          tone: 'stillness',
        },
        {
          id: 'two-sword-paths',
          title: '两道剑途',
          scene: '红尘剑宗 · 照影崖',
          body: '崖前剑影一快一重。快剑连绵，转瞬已在石壁留下数道剑痕；重剑静立，直至来势逼近，才以后发一击震开尘土。',
          speaker:
            '传功长老：“照影游尘，见招而变；守拙藏锋，承势而决。剑路不同，最后问的却是同一件事。”',
          backgroundPosition: '42% 44%',
          tone: 'mist',
        },
        {
          id: 'one-life-one-sword',
          title: '此剑平生',
          scene: '红尘剑宗 · 弟子名册前',
          body: '你的名字被写入弟子名册，《红尘剑录》中属于你的那一页仍然空白。长老合上旧卷，将那柄铁剑连同剑鞘一并交到你手中。',
          speaker:
            '传功长老：“今日不必写。等你真正明白为何出剑，再回来落这一笔。”',
          backgroundPosition: '54% 35%',
          tone: 'steel',
        },
      ],
    },
  },
  map: {
    image: '/assets/sect/lingxiao-map.webp',
    alt: '红尘剑宗殿阁、试剑台、工坊、矿场与药田沿山路连接山下城郭的水墨鸟瞰图',
    hotspots: [
      {
        id: 'hall',
        label: '问剑堂',
        route: '/game/sect/hall',
        permission: 'sect.hall.view',
        left: '46%',
        top: '25%',
        note: '身份 · 晋升 · 周俸',
      },
      {
        id: 'archive',
        label: '剑录阁',
        route: '/game/sect/archive',
        facility: 'archive',
        permission: 'sect.archive.use',
        left: '15%',
        top: '31%',
        note: '心法研习',
      },
      {
        id: 'cliff',
        label: '照影崖',
        route: '/game/sect/enlightenment-cliff',
        permission: 'sect.enlightenment.use',
        left: '88%',
        top: '19%',
        note: '流派 · 经脉',
      },
      {
        id: 'arena',
        label: '试剑台',
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
        label: '养剑室',
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
        label: '铸剑坊',
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
    archive: '剑录阁',
    cultivation_room: '养剑室',
    workshop: '丹器坊',
    spirit_vein: '灵脉',
    herb_garden: '药田',
    formation: '护山大阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: {
      title: '红尘剑宗舆图',
      description:
        '殿阁沿山势铺开，主路穿过山门直通城郭。择一处前往，继续今日的宗门事务。',
      loadingText: '山路与诸院渐次显现……',
    },
    hall: {
      title: '问剑堂',
      description:
        '堂中不设试剑石，只悬历代门人的旧剑与归宗名册；身份玉牒、俸禄名册皆由录事在此核验。',
    },
    affairs: {
      title: '执事堂',
      description:
        '木榜上新令墨迹未干，今日差事、周录与晋升试炼各有封签；择下一令，便不可在当日更换。',
      loadingText: '执事正整理今日委托……',
    },
    archive: {
      title: '剑录阁',
      description:
        '檀木长架上既有六卷心法，也收着历代弟子的行剑手记；在此逐卷研习，不必再穿行别阁。',
      loadingText: '剑录阁卷帙正在归架……',
    },
    paths: {
      title: '照影崖',
      description:
        '崖壁遍布历代门人留下的试剑痕迹，快重二道皆由此分流；择定道途后，沿经脉继续参悟。',
      loadingText: '崖前剑影正在散开……',
    },
    arena: {
      title: '试剑台',
      description:
        '演武场中央阵纹已启，宗门神通将在当前流派与参悟方案下显化威能。',
      loadingText: '试剑台阵纹徐徐亮起……',
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
      title: '养剑室',
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
      title: '铸剑坊',
      description:
        '地火自山腹引入锻台，冷铁与灵材依次落位；选定器型后即可在此开炉成器。',
      loadingText: '铸剑坊地火正在升温……',
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
        '石阶从门外一路通往山下城郭，守门弟子在晨钟后换过值守；今日宗门内外动静都写在门侧木牌上。',
      loadingText: '山门晨钟沿石阶传来……',
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
    sweepActivity: '山阶扫叶',
    sweepCanvasLabel: '山阶扫叶游戏画布',
  },
};
