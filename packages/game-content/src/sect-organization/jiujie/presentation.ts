import type {
  SectMapHotspot,
  SectPresentationTheme,
} from '@daoyou/game-domain/sects';
import { JIUJIE_SECT_ID } from './ids.js';
const h = (
  id: string,
  label: string,
  left: string,
  top: string,
  route: string,
  permission: SectMapHotspot['permission'],
  note: string,
  facility?: string,
  locked?: boolean,
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
  locked,
  visitor,
});
export const JIUJIE_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: JIUJIE_SECT_ID,
  announcement:
    '雷池今夜三次合鸣，劫簿殿已封存旧页。弟子行经天阶，须先听雷，再入宫门。',
  map: {
    image: '/assets/sect/jiujie-map.webp',
    alt: '九劫天宫雷墟天阙舆图，中央雷池连接引雷天阶、劫眼峰、天谴司与悬浮宫城。',
    aspectRatio: 1536 / 1024,
    hotspots: [
      h(
        'hall',
        '中天雷池',
        '50%',
        '50%',
        '/game/sect/hall',
        'sect.hall.view',
        '身份 · 同门 · 周俸',
      ),
      h(
        'archive',
        '劫簿殿',
        '50%',
        '8%',
        '/game/sect/archive',
        'sect.archive.use',
        '心法研习',
        'archive',
      ),
      h(
        'cliff',
        '劫眼峰',
        '17%',
        '31%',
        '/game/sect/enlightenment-cliff',
        'sect.enlightenment.use',
        '霹雳真君 · 流派参悟',
      ),
      h(
        'condemnation',
        '天谴司',
        '82%',
        '31%',
        '/game/sect/enlightenment-cliff',
        'sect.enlightenment.use',
        '踏雷天尊 · 流派参悟',
      ),
      h(
        'affairs',
        '引雷天阶',
        '50%',
        '71%',
        '/game/sect/affairs',
        'sect.tasks.use',
        '日常 · 周常 · 晋升',
      ),
      h(
        'arena',
        '雷台演武场',
        '50%',
        '28%',
        '/game/sect/arena',
        'sect.arena.use',
        '小比 · 演武',
      ),
      h(
        'treasury',
        '天衡库',
        '74%',
        '42%',
        '/game/sect/treasury',
        'sect.shop.use',
        '贡献兑换',
      ),
      h(
        'industries',
        '营造司',
        '82%',
        '73%',
        '/game/sect/industries',
        'sect.construction.view',
        '设施建设 · 灵石捐献',
      ),
      h(
        'cultivation',
        '渡厄静室',
        '38%',
        '14%',
        '/game/sect/cultivation-room',
        'sect.facility.cultivation.use',
        '闭关修炼 · 设施灵效',
        'cultivation_room',
      ),
      h(
        'alchemy',
        '听雷丹房',
        '67%',
        '14%',
        '/game/sect/alchemy',
        'sect.facility.alchemy.use',
        '炼丹 · 设施灵效',
        'workshop',
      ),
      h(
        'refinery',
        '断劫炉',
        '89%',
        '48%',
        '/game/sect/refinery',
        'sect.facility.refinery.use',
        '炼器 · 设施灵效',
        'workshop',
      ),
      h(
        'vein',
        '雷髓晶矿',
        '17%',
        '67%',
        '/game/sect/spirit-vein',
        'sect.spirit_vein.view',
        '矿场巡视 · 灵石收益 · 采矿',
        'spirit_vein',
      ),
      h(
        'garden',
        '天听木圃',
        '9%',
        '80%',
        '/game/sect/herb-garden',
        'sect.herb_garden.view',
        '草木长势 · 产出待开放',
        'herb_garden',
      ),
      h(
        'gate',
        '九劫天门',
        '50%',
        '88%',
        '/game/sect/gate',
        'sect.gate.view',
        '山门动态 · 清扫差事',
        undefined,
        undefined,
        { description: '九劫天门尚未全开，外客只能在山门外递交拜帖。' },
      ),
      h(
        'cave',
        '雷隐居',
        '29%',
        '79%',
        '/game/sect/cave',
        'sect.cave.view',
        '弟子居所',
      ),
      {
        id: 'formation',
        label: '渡厄天梯',
        left: '61%',
        top: '23%',
        permission: 'sect.formation.view',
        note: '宗门战后续开放',
        facility: 'formation',
        locked: true,
        visitor: {
          description: '九重天门尚未开启，外客只能在天阶尽头听见雷声。',
        },
      },
    ],
  },
  facilityLabels: {
    archive: '劫簿殿',
    cultivation_room: '渡厄静室',
    workshop: '断劫炉',
    alchemy: '听雷丹房',
    refinery: '断劫炉',
    spirit_vein: '雷髓晶矿',
    herb_garden: '天听木圃',
    formation: '渡厄天梯',
  },
  lockedFacilities: ['formation'],
  rooms: {
    affairs: {
      actors: {
        daily: {
          id: 'jiujie-daily',
          name: '照雷执事',
          greeting: '今日雷声平稳，日常事务可依劫簿次序领取。',
        },
        weekly: {
          id: 'jiujie-weekly',
          name: '守簿翁',
          greeting: '周常卷宗已按雷痕归档，想查哪一卷？',
        },
        promotion: {
          id: 'jiujie-promotion',
          name: '九门长老',
          greeting: '晋升之前，先问你是否敢直面自己的劫。',
        },
      },
    },
    hall: {
      actors: {
        registry: {
          id: 'jiujie-registry',
          name: '司雷',
          greeting: '身份与名册均已听雷登记。',
        },
        stipend: {
          id: 'jiujie-stipend',
          name: '听劫',
          greeting: '周俸按雷池规矩发放。',
        },
      },
    },
    treasury: {
      actors: {
        keeper: {
          id: 'jiujie-treasury',
          name: '衡天',
          greeting: '贡献与库藏皆有天平。',
        },
      },
    },
    industries: {
      actors: {
        construction: {
          id: 'jiujie-construction',
          name: '营造监',
          greeting: '雷台与天阶的修缮均已列入簿册。',
        },
        donation: {
          id: 'jiujie-donation',
          name: '捐献使',
          greeting: '灵石可助天宫修复旧阵。',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          id: 'jiujie-archive',
          name: '掌卷',
          greeting: '劫簿殿只收能经得起天听的记录。',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          id: 'jiujie-guide',
          name: '引路天官',
          greeting: '两道劫法，皆从同一声雷开始。',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          id: 'jiujie-instructor',
          name: '演武教习',
          greeting: '先挂雷，再看对手是否仍要出手。',
        },
        marshal: {
          id: 'jiujie-marshal',
          name: '执刑',
          greeting: '雷台只记行动，不记借口。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          id: 'jiujie-cultivation',
          name: '守静',
          greeting: '闭关之前，先让心神渡过雷声。',
        },
      },
    },
    alchemy: {
      actors: {
        keeper: {
          id: 'jiujie-alchemy',
          name: '听雷丹师',
          greeting: '雷髓入炉，火候须听天声。',
        },
      },
    },
    refinery: {
      actors: {
        keeper: {
          id: 'jiujie-refinery',
          name: '断劫使',
          greeting: '旧劫铁已经分拣完毕。',
        },
      },
    },
    spiritVein: {
      actors: {
        keeper: {
          id: 'jiujie-vein',
          name: '雷髓监',
          greeting: '今日雷髓晶脉没有异常。',
        },
        facility: {
          id: 'jiujie-pool',
          name: '中天雷池',
          greeting: '雷池中心的白光一息未停。',
        },
      },
    },
    herbGarden: {
      actors: {
        keeper: {
          id: 'jiujie-garden',
          name: '守园',
          greeting: '天听木的枝叶又记下了一夜雷声。',
        },
        facility: {
          id: 'jiujie-wood',
          name: '天听木圃',
          greeting: '古木不倒，正好承接余雷。',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          id: 'jiujie-gatekeeper',
          name: '守天阶',
          greeting: '拜帖与来意一致，方可登阶。',
        },
        facility: {
          id: 'jiujie-gate',
          name: '九劫天阶',
          greeting: '天阶尽头仍有八门未开。',
        },
      },
    },
  },
  scenes: {
    map: {
      title: '雷墟天阙',
      description: '雷池为心，九门为界。',
      loadingText: '正在听取天宫雷声……',
    },
  },
  terms: {
    pathChanges: '道途裁定',
    meridianPractice: '天宫参悟',
    meridianLoadout: '劫法方案',
    abilityChanges: '神通裁定',
    returnToAffairs: '返回引雷天阶',
  },
};
