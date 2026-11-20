import type { SectPresentationTheme } from '@daoyou/game-domain/sects';
import { LINGXIAO_SECT_ID } from './ids.js';

export const LINGXIAO_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: LINGXIAO_SECT_ID,
  announcement:
    '近日山下商路多有邪修出没，外出历练者须结伴而行；归宗后记得向执事堂补录见闻。',
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
        note: '身份 · 同门 · 周俸',
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
        note: '流派 · 参悟',
      },
      {
        id: 'arena',
        label: '试剑台',
        route: '/game/sect/arena',
        permission: 'sect.arena.use',
        left: '57%',
        top: '64%',
        note: '小比 · 演武',
      },
      {
        id: 'affairs',
        label: '执事堂',
        route: '/game/sect/affairs',
        permission: 'sect.tasks.use',
        left: '42%',
        top: '48%',
        note: '日常 · 周常 · 晋升',
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
        note: '设施建设 · 灵石捐献',
      },
      {
        id: 'cultivation',
        label: '养剑室',
        route: '/game/sect/cultivation-room',
        facility: 'cultivation_room',
        permission: 'sect.facility.cultivation.use',
        left: '17%',
        top: '72%',
        note: '闭关修炼 · 设施灵效',
      },
      {
        id: 'alchemy',
        label: '丹房',
        route: '/game/sect/alchemy',
        facility: 'workshop',
        permission: 'sect.facility.alchemy.use',
        left: '64%',
        top: '43%',
        note: '炼丹 · 设施灵效',
      },
      {
        id: 'refinery',
        label: '铸剑坊',
        route: '/game/sect/refinery',
        facility: 'workshop',
        permission: 'sect.facility.refinery.use',
        left: '69%',
        top: '51%',
        note: '炼器 · 设施灵效',
      },
      {
        id: 'vein',
        label: '灵脉矿场',
        route: '/game/sect/spirit-vein',
        facility: 'spirit_vein',
        permission: 'sect.spirit_vein.view',
        left: '84%',
        top: '46%',
        note: '矿场巡视 · 灵石收益 · 采矿',
      },
      {
        id: 'garden',
        label: '药田',
        route: '/game/sect/herb-garden',
        facility: 'herb_garden',
        permission: 'sect.herb_garden.view',
        left: '83%',
        top: '75%',
        note: '草木长势 · 产出待开放',
      },
      {
        id: 'gate',
        label: '山门',
        route: '/game/sect/gate',
        permission: 'sect.gate.view',
        left: '48%',
        top: '77%',
        note: '山门动态 · 清扫差事',
        visitor: {
          description: '山门外的石阶直通城郭，守门弟子会为外客登记来意与拜帖。',
        },
      },
      {
        id: 'cave',
        label: '私人洞府',
        route: '/game/sect/cave',
        permission: 'sect.cave.view',
        left: '26%',
        top: '66%',
        note: '弟子居所',
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
        visitor: {
          description:
            '剑痕沿群峰与山路首尾相接，外客只能在阵外看见偶尔掠过云层的锋光。',
        },
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
        '木榜上新令墨迹未干，今日差事、周录与晋升试炼各有封签；诸令皆可逐一揭下，办妥后回堂交卷领赏。',
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
        '各处设施的等级与建设进度依次列于案台，弟子可择一处捐献灵石。',
      loadingText: '百业院正在汇总设施进度……',
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
        '层层药畦顺山势铺开，灵泉沿石渠润过根须；药田产出玩法后续开放。',
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
  rooms: {
    affairs: {
      description:
        '旧剑与功簿分列堂中，三席经办之人各守一案。寻到对应之人，便可当面接下或交回事务。',
      actors: {
        daily: {
          id: 'lingxiao-lin-yanqiu',
          name: '陆青崖',
          greeting: '今日事务已经理清，你先说想办哪一桩。',
        },
        weekly: {
          id: 'lingxiao-gu-wenfeng',
          name: '裴守拙',
          greeting: '本周功簿在此，小比与悬赏也都记着。',
        },
        promotion: {
          id: 'lingxiao-xie-tingyun',
          name: '听剑老人',
          greeting: '晋升问的不是锋芒多少，而是这一剑为何而出。',
        },
      },
    },
    hall: {
      actors: {
        registry: {
          id: 'lingxiao-shen-chijian',
          name: '顾怀真',
          greeting: '玉牒和同门名录都已理好，你想查哪一项？',
        },
        stipend: {
          id: 'lingxiao-wen-fenglu',
          name: '柳七',
          greeting: '本周该发的都已算清，要核对还是领取，你直说便是。',
        },
      },
    },
    treasury: {
      actors: {
        keeper: {
          id: 'lingxiao-cangfeng-weng',
          name: '叶归鸿',
          greeting: '架上的东西各有标价，你看中哪件便报来。',
        },
      },
    },
    industries: {
      actors: {
        construction: {
          id: 'lingxiao-zhu-baigong',
          name: '杜长庚',
          greeting: '各处设施修到哪里、还差多少，我都能说给你听。',
        },
        donation: {
          id: 'lingxiao-shi-sanjin',
          name: '苗小满',
          greeting: '今日可择一处设施捐献灵石，我替你登记。',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          id: 'lingxiao-xie-guanjian',
          name: '温不言',
          greeting: '六卷心法都在架上，先说你想读哪一卷。',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          id: 'lingxiao-wenjian-sou',
          name: '祝平生',
          greeting: '路要自己走，眼下看不明白的地方可以先问。',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          id: 'lingxiao-fu-shifeng',
          name: '霍千钧',
          greeting: '招式合不合手，上场一试便知；先把你的神通排给我看。',
        },
        marshal: {
          id: 'lingxiao-chen-shoutai',
          name: '苏放鹤',
          greeting: '场中已经收拾妥当，有小比在身便可入场。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          id: 'lingxiao-su-jing',
          name: '晏无声',
          greeting: '阵息正稳，想问此地灵效，还是现在入静？',
        },
      },
    },
    alchemy: {
      actors: {
        keeper: {
          id: 'lingxiao-yan-danshi',
          name: '程晚照',
          greeting: '火候正好，想先问丹房灵效，还是直接开炉？',
        },
      },
    },
    refinery: {
      actors: {
        keeper: {
          id: 'lingxiao-ou-yeqing',
          name: '谭折柳',
          greeting: '地火还稳，想先问器坊灵效，还是就此动手？',
        },
      },
    },
    spiritVein: {
      actors: {
        keeper: {
          id: 'lingxiao-luo-tingmai',
          name: '邵沉川',
          greeting: '矿道巡视封签已经备好，有差事便在这里核对。',
        },
        facility: {
          id: 'lingxiao-lingmai-kuangchang',
          name: '灵脉矿场',
          greeting: '矿壁间青光沿岩隙缓缓游走，脉息沉稳如常。',
        },
      },
    },
    herbGarden: {
      actors: {
        keeper: {
          id: 'lingxiao-he-caowei',
          name: '秦晚晴',
          greeting: '晨露刚退，田里长势不错，草木值录已经写好了。',
        },
        facility: {
          id: 'lingxiao-zongmen-yaotian',
          name: '宗门药田',
          greeting: '层层药畦顺山势铺开，灵泉正沿石渠润过根须。',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          id: 'lingxiao-zhou-shanmen',
          name: '骆长亭',
          greeting: '山下已经有人来往，今日来客与山门动静都记在这里。',
        },
        facility: {
          id: 'lingxiao-shanmen',
          name: '山门',
          greeting: '门外石阶一路通向山下，晨风卷来几片新落的叶子。',
        },
      },
    },
  },
  terms: {
    pathChanges: '剑路变化',
    meridianPractice: '剑道参悟',
    meridianLoadout: '参悟方案',
    abilityChanges: '神通变化',
    returnToAffairs: '返回执事堂',
  },
};
