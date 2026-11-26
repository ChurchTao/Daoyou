import type {
  SectMapHotspot,
  SectPresentationTheme,
} from '@daoyou/game-domain/sects';
import { TIANYAN_SECT_ID } from './ids.js';

const hotspot = (
  id: string,
  label: string,
  left: string,
  top: string,
  route: string | undefined,
  permission: SectMapHotspot['permission'],
  note: string,
  facility?: string,
  visitor?: SectMapHotspot['visitor'],
): SectMapHotspot => ({
  id,
  label,
  left,
  top,
  route,
  permission,
  note,
  facility,
  visitor,
});

export const TIANYAN_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: TIANYAN_SECT_ID,
  announcement:
    '五峰水脉本旬将依新阵图调度，诸弟子行经中宫时请勿挪动地刻与测算标记。',
  map: {
    image: '/assets/sect/tianyan-map.webp',
    alt: '天衍圣地五峰环绕中宫，水脉、药圃、炉院、土台与矿路首尾相接的云海舆图',
    hotspots: [
      hotspot(
        'hall',
        '衍天殿',
        '50%',
        '41%',
        '/game/sect/hall',
        'sect.hall.view',
        '身份 · 同门 · 周俸',
      ),
      hotspot(
        'archive',
        '五经阁',
        '29%',
        '22%',
        '/game/sect/archive',
        'sect.archive.use',
        '心法研习',
        'archive',
      ),
      hotspot(
        'cliff',
        '河洛台',
        '66%',
        '22%',
        '/game/sect/enlightenment-cliff',
        'sect.enlightenment.use',
        '流派 · 参悟',
      ),
      hotspot(
        'arena',
        '中宫演法台',
        '50%',
        '49%',
        '/game/sect/arena',
        'sect.arena.use',
        '小比 · 演武',
      ),
      hotspot(
        'affairs',
        '司算院',
        '58%',
        '47%',
        '/game/sect/affairs',
        'sect.tasks.use',
        '日常 · 周常 · 晋升',
      ),
      hotspot(
        'treasury',
        '天衡库',
        '35%',
        '67%',
        '/game/sect/treasury',
        'sect.shop.use',
        '贡献兑换',
      ),
      hotspot(
        'industries',
        '营造司',
        '80%',
        '60%',
        '/game/sect/industries',
        'sect.construction.view',
        '设施建设 · 灵石捐献',
      ),
      hotspot(
        'cultivation',
        '太初静室',
        '15%',
        '57%',
        '/game/sect/cultivation-room',
        'sect.facility.cultivation.use',
        '闭关修炼 · 设施灵效',
        'cultivation_room',
      ),
      hotspot(
        'alchemy',
        '青华丹院',
        '30%',
        '29%',
        '/game/sect/alchemy',
        'sect.facility.alchemy.use',
        '炼丹 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'refinery',
        '太白铸府',
        '35%',
        '75%',
        '/game/sect/refinery',
        'sect.facility.refinery.use',
        '炼器 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'vein',
        '坤元地脉',
        '82%',
        '54%',
        '/game/sect/spirit-vein',
        'sect.spirit_vein.view',
        '矿场巡视 · 灵石收益 · 采矿',
        'spirit_vein',
      ),
      hotspot(
        'garden',
        '长生圃',
        '26%',
        '15%',
        '/game/sect/herb-garden',
        'sect.herb_garden.view',
        '草木长势 · 产出待开放',
        'herb_garden',
      ),
      hotspot(
        'gate',
        '观象门',
        '50%',
        '88%',
        '/game/sect/gate',
        'sect.gate.view',
        '山门动态 · 清扫差事',
        undefined,
        {
          description:
            '观象门正对云海，外客可在门侧石刻前递交名帖，等待执教回应。',
        },
      ),
      hotspot(
        'cave',
        '云衡洞府',
        '13%',
        '50%',
        '/game/sect/cave',
        'sect.cave.view',
        '弟子居所',
      ),
      {
        id: 'formation',
        label: '五峰归流阵眼',
        left: '50%',
        top: '53%',
        permission: 'sect.formation.view',
        note: '宗门战后续开放',
        facility: 'formation',
        locked: true,
        visitor: {
          description:
            '五峰灵机经水脉、炉院与矿路汇入中宫，外客可观其势，不得踏入阵眼。',
        },
      },
    ],
  },
  facilityLabels: {
    archive: '五经阁',
    cultivation_room: '太初静室',
    workshop: '太白铸府',
    spirit_vein: '坤元地脉',
    herb_garden: '长生圃',
    formation: '五峰归流阵眼',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: {
      title: '天衍圣地舆图',
      description:
        '五峰环绕中宫，水脉、药圃、炉院、土台与矿路首尾相接；诸峰各有所长，却始终在同一轮推演中运转。',
      loadingText: '五峰水脉正在归流中宫……',
    },
    hall: {
      title: '衍天殿',
      description:
        '大殿不悬天命判词，只陈历代推演中被事实改写的旧卷。身份玉牒与周俸名册置于中宫汇流地刻之后，雨水沿殿前石槽缓缓分入五峰。',
    },
    affairs: {
      title: '司算院',
      description:
        '新差事依时辰、地脉与人手写入长卷；执事会标出已知条件，却从不替接取者写下唯一答案。',
    },
    archive: {
      title: '五经阁',
      description:
        '六卷真经分藏于中央与五行书架。卷册之间留有大量空白，供后来者记录术法相接时出现的新变化。',
    },
    paths: {
      title: '河洛台',
      description:
        '衍法天师借五行变化延展法势，执衡真君以生克之理破护断势。两条道途同修五行，各有取舍。',
    },
    arena: {
      title: '中宫演法台',
      description:
        '五道地刻汇于圆台。弟子在此更换神通、校验法印，也复盘每一次被错误次序覆盖的余势。',
    },
    cultivation: {
      title: '太初静室',
      description:
        '静室内没有五色阵光，只留一线无色灵气。门人需先让本命之气安静下来，才能重走太初衍脉。',
    },
    alchemy: {
      title: '青华丹院',
      description:
        '木架、活水与温炉依次相连。药师记录的不只是药性，也包括采时、火候和前一炉留下的余温。',
    },
    refinery: {
      title: '太白铸府',
      description:
        '金石在炉火与水渠之间往复，锤下每一道锋面都有明确去处；废料也会归入下一炉，而非弃在山外。',
    },
    spiritVein: {
      title: '坤元地脉',
      description:
        '山腹地脉托住五峰阵基。厚土不显于天际，却决定廊桥、水渠与炉道能否在云雨之后仍守住原位。',
    },
    herbGarden: {
      title: '长生圃',
      description:
        '灵草依水位与日照分层种植。圃中没有永远固定的田垄，每一季都会按照观象记录重新调整。',
    },
    gate: {
      title: '观象门',
      description:
        '山门正对云海，门侧刻着历年天象与实际结果。偏差没有被抹去，反而比准确的预言保存得更久。',
    },
    cave: {
      title: '云衡洞府',
      description:
        '洞府散在玄冥、青华二峰之间。每处门前都嵌一片集露白铜，清晨水痕会留下不同走向，提醒主人今日的判断也会随明日天光改变。',
    },
  },
  rooms: {
    affairs: {
      description: '司算院长卷依时辰铺开，日常、周常与晋升事务各归一席。',
      actors: {
        daily: {
          id: 'tianyan-ji-sichen',
          name: '知微',
          greeting: '今日时序已经排定，眼下可办的差事都在这里。',
        },
        weekly: {
          id: 'tianyan-xu-hengzhang',
          name: '玄衡道人',
          greeting: '本周诸事已有定数，但落子之人仍要你自己选。',
        },
        promotion: {
          id: 'tianyan-rong-guanlan',
          name: '观澜真人',
          greeting: '晋升试炼不求捷径，只看你能否辨清下一步。',
        },
      },
    },
    hall: {
      actors: {
        registry: {
          id: 'tianyan-siming',
          name: '含章真人',
          greeting: '玉牒与名录已经复核，你可以从任何一项开始查验。',
        },
        stipend: {
          id: 'tianyan-duzhi',
          name: '清和',
          greeting: '本周俸数已按实录核定，领取前也可再核一遍。',
        },
      },
    },
    treasury: {
      actors: {
        keeper: {
          id: 'tianyan-tianku',
          name: '怀谷道人',
          greeting: '常备与轮换库存已经清点，你想先看哪一类？',
        },
      },
    },
    industries: {
      actors: {
        construction: {
          id: 'tianyan-banji',
          name: '鸣谦道人',
          greeting: '各处设施都有实数可查，你想先听哪一项进展？',
        },
        donation: {
          id: 'tianyan-ducai',
          name: '履霜',
          greeting: '灵石数目须与建设档位相合，你想投向哪处设施？',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          id: 'tianyan-yanshu',
          name: '既白真人',
          greeting: '六卷真经都已归位，你想从哪一卷开始研习？',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          id: 'tianyan-heluozhi',
          name: '观复真人',
          greeting: '推演先看已有之势，你想从哪条道途开始辨明？',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          id: 'tianyan-douheng',
          name: '玄同道人',
          greeting: '神通次序与战术都可重排，先把当前配置展开吧。',
        },
        marshal: {
          id: 'tianyan-jiaochang',
          name: '景初',
          greeting: '演武场已经归整，有小比记录便可开场。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          id: 'tianyan-shouyi',
          name: '抱一真人',
          greeting: '阵中灵气已经归稳，想先查灵效，还是开始闭关？',
        },
      },
    },
    alchemy: {
      actors: {
        keeper: {
          id: 'tianyan-qinghe',
          name: '允中道人',
          greeting: '炉温与水候均在合宜范围，要查灵效还是开炉？',
        },
      },
    },
    refinery: {
      actors: {
        keeper: {
          id: 'tianyan-baishi',
          name: '松乔道人',
          greeting: '金石与地火都已就位，要查灵效还是开始炼器？',
        },
      },
    },
    spiritVein: {
      actors: {
        keeper: {
          id: 'tianyan-kunyuan',
          name: '见素',
          greeting: '今日观测未见异常，矿道巡视封签已经排好。',
        },
        facility: {
          id: 'tianyan-kunyuan-dimai',
          name: '坤元地脉',
          greeting: '厚土地脉沉在五峰之下，灵辉沿测线缓缓明灭。',
        },
      },
    },
    herbGarden: {
      actors: {
        keeper: {
          id: 'tianyan-mushi',
          name: '元吉',
          greeting: '水位、日照与长势都已记下，今日值录可以查验。',
        },
        facility: {
          id: 'tianyan-changsheng-pu',
          name: '长生圃',
          greeting: '田垄依照水位与日照铺开，新一季灵草正在生长。',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          id: 'tianyan-guanxing',
          name: '望舒',
          greeting: '今日山门记录已经补全，来往与观象结果都可查问。',
        },
        facility: {
          id: 'tianyan-guanxiang-men',
          name: '观象门',
          greeting: '门前云气刚散，石阶上还留着昨夜风雨卷来的落叶。',
        },
      },
    },
  },
  terms: {
    pathChanges: '河洛变化',
    meridianPractice: '天衍参悟',
    meridianLoadout: '推演方案',
    abilityChanges: '神通衍变',
    returnToAffairs: '返回司算院',
  },
};
