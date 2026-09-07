import type { SectMapHotspot, SectPresentationTheme } from '../../core';
import { YOUDU_SECT_ID } from './ids';

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

export const YOUDU_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: YOUDU_SECT_ID,
  announcement:
    '黑水沿岸近来魂灯摇曳，夜巡弟子须两人同行；若见失名游魂，先引至招魂司登记。',
  onboarding: {
    summary:
      '黑水照影，幽灯唤魂。你将在敌人仍然站立时，一层层取走支撑其形神的力量。',
    traits: ['蚀魂叠层', '魂伤越防', '禁疗耐控'],
    script: {
      id: 'youdu-onboarding',
      title: '一叹入幽都',
      theme: 'stillness',
      backdrop: {
        src: '/assets/sect/onboarding/youdu.webp',
        alt: '幽都山门前，弟子沿三盏魂灯照亮的黑水石径入山，水中倒影与本人错开半步',
      },
      acts: [
        {
          id: 'black-water-shadow',
          title: '黑水有影',
          scene: '幽都 · 黑水石径',
          body: '你沿北海石径入山。天上没有月，黑水却照出你的脸。水中那张脸比你迟了一息才抬眼。',
          backgroundPosition: '48% 54%',
          tone: 'stillness',
        },
        {
          id: 'three-calls',
          title: '三声唤名',
          scene: '幽都 · 无日关',
          body: '山门内有人依次唤出你的姓名、来处与心中最不愿失去之物。前两声都有回音，第三声落下时，身后的影子轻轻动了一下。',
          speaker:
            '引路人：“莫回头。能随一声呼唤离身的，未必是鬼，也可能是你自己。”',
          backgroundPosition: '60% 45%',
          tone: 'mist',
        },
        {
          id: 'seven-lamps',
          title: '七灯照身',
          scene: '幽都 · 七魄台',
          body: '七盏灯从暗处逐一亮起。你每走过一盏，脚步便轻一分，直到分不清是身体在前行，还是影子拖着身体。',
          backgroundPosition: '35% 48%',
          tone: 'stillness',
        },
        {
          id: 'where-soul-returns',
          title: '魂归何处',
          scene: '幽都 · 幽都殿',
          body: '殿中没有神像，只有一面黑水。掌门问你：若能唤走仇敌的魂，也能唤回他的魂，你以哪一声为本事？你承认自己尚不知道答案。',
          backgroundPosition: '50% 38%',
          tone: 'mist',
        },
        {
          id: 'one-sigh-entry',
          title: '一叹入门',
          scene: '幽都 · 魂灯前',
          body: '掌门吹灭其中一盏灯，灯焰却出现在你掌心。黑水里的倒影终于与你同时抬头。',
          speaker:
            '掌门：“先学叹息。唯有一声叹息，最容易让人忘记守住自己的魂。”',
          backgroundPosition: '52% 44%',
          tone: 'ember',
        },
      ],
    },
  },
  map: {
    image: '/assets/sect/youdu-map.webp',
    alt: '幽都宗门舆图，黑水穿过幽都殿、七魄台、照影场与山中诸院',
    hotspots: [
      hotspot(
        'hall',
        '幽都殿',
        '49%',
        '20%',
        '/game/sect/hall',
        'sect.hall.view',
        '身份 · 同门 · 周俸',
      ),
      hotspot(
        'archive',
        '三魂阁',
        '25%',
        '40%',
        '/game/sect/archive',
        'sect.archive.use',
        '心法研习',
        'archive',
      ),
      hotspot(
        'cliff',
        '七魄台',
        '18%',
        '24%',
        '/game/sect/enlightenment-cliff',
        'sect.enlightenment.use',
        '流派 · 参悟',
      ),
      hotspot(
        'arena',
        '照影场',
        '43%',
        '57%',
        '/game/sect/arena',
        'sect.arena.use',
        '神通 · 战术 · 小比',
      ),
      hotspot(
        'affairs',
        '招魂司',
        '34%',
        '46%',
        '/game/sect/affairs',
        'sect.tasks.use',
        '日常 · 周常 · 晋升',
      ),
      hotspot(
        'treasury',
        '玄冥库',
        '63%',
        '68%',
        '/game/sect/treasury',
        'sect.shop.use',
        '贡献兑换',
      ),
      hotspot(
        'industries',
        '黑水坊',
        '48%',
        '78%',
        '/game/sect/industries',
        'sect.construction.view',
        '设施建设 · 灵石捐献',
      ),
      hotspot(
        'cultivation',
        '返照室',
        '12%',
        '62%',
        '/game/sect/cultivation-room',
        'sect.facility.cultivation.use',
        '闭关修炼 · 设施灵效',
        'cultivation_room',
      ),
      hotspot(
        'alchemy',
        '还魂药庐',
        '73%',
        '50%',
        '/game/sect/alchemy',
        'sect.facility.alchemy.use',
        '炼丹 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'refinery',
        '镇铁炉',
        '82%',
        '71%',
        '/game/sect/refinery',
        'sect.facility.refinery.use',
        '炼器 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'vein',
        '黑水阴脉',
        '90%',
        '44%',
        '/game/sect/spirit-vein',
        'sect.spirit_vein.view',
        '矿场巡视 · 灵石收益 · 采矿',
        'spirit_vein',
      ),
      hotspot(
        'garden',
        '彼岸圃',
        '70%',
        '37%',
        '/game/sect/herb-garden',
        'sect.herb_garden.view',
        '草木长势 · 产出待开放',
        'herb_garden',
      ),
      hotspot(
        'gate',
        '无日关',
        '49%',
        '87%',
        '/game/sect/gate',
        'sect.gate.view',
        '山门动态 · 清扫差事',
        undefined,
        {
          description:
            '三盏魂灯在无日关外照出访客影子，守关人只接下姓名与来意相符的拜帖。',
        },
      ),
      hotspot(
        'cave',
        '寄魂庐',
        '88%',
        '31%',
        '/game/sect/cave',
        'sect.cave.view',
        '弟子居所',
      ),
      {
        id: 'formation',
        label: '万魂归窍阵',
        left: '79%',
        top: '14%',
        permission: 'sect.formation.view',
        note: '宗门战后续开放',
        facility: 'formation',
        locked: true,
        visitor: {
          description:
            '黑水与魂灯牵引归路，外客只能在灯外辨认阵纹，不能越过无日关。',
        },
      },
    ],
  },
  facilityLabels: {
    archive: '三魂阁',
    cultivation_room: '返照室',
    workshop: '镇铁炉',
    alchemy: '还魂药庐',
    refinery: '镇铁炉',
    spirit_vein: '黑水阴脉',
    herb_garden: '彼岸圃',
    formation: '万魂归窍阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: {
      title: '幽都舆图',
      description: '黑水自山腹流过两岸诸院，灯影与人影总错开半步。',
      loadingText: '魂灯正沿黑水次第亮起……',
    },
    hall: {
      title: '幽都殿',
      description: '殿中无神像，只有映照姓名、来处与归路的一面黑水。',
    },
    affairs: {
      title: '招魂司',
      description: '门人记录失名者、游魂与界隙回声，也护送愿意归去的魂。',
    },
    archive: {
      title: '三魂阁',
      description: '六卷心法分藏于三层暗阁，书页以魂灯照见。',
    },
    paths: {
      title: '七魄台',
      description: '魂灯照见两条道途，沿着七魄留下的痕迹，静心参悟各自的传承。',
    },
    arena: {
      title: '照影场',
      description: '场中不立木人，只以黑水映出每一门神通落在影上的痕迹。',
    },
    cultivation: {
      title: '返照室',
      description: '一灯一席，修士在寂静中确认三魂七魄仍各安其位。',
    },
    alchemy: {
      title: '还魂药庐',
      description: '返照香与彼岸草分柜存放，药师只治魂魄缝隙，不许强拘生魂。',
    },
    refinery: {
      title: '镇铁炉',
      description: '黑水旧铁在低焰中缓慢成形，专用来定影稳神。',
    },
    spiritVein: {
      title: '黑水阴脉',
      description: '灵石沿湿冷岩层生长，表面映不出开采者的面孔。',
    },
    herbGarden: {
      title: '彼岸圃',
      description: '深色花叶沿黑水两岸生长；药田产出玩法后续开放。',
    },
    gate: {
      title: '无日关',
      description: '关外不见日月，三盏魂灯为每个归山者留着方向。',
    },
    cave: {
      title: '寄魂庐',
      description: '庐舍门前各悬一灯，灯在便知主人形神安稳。',
    },
  },
  rooms: {
    affairs: {
      description: '招魂司内灯影不灭，日常、周常与晋升事务各由一席经办。',
      actors: {
        daily: {
          id: 'youdu-shen-zhaodeng',
          name: '照灯',
          greeting: '今日卷宗都在灯下，你想办哪一件，直说便是。',
        },
        weekly: {
          id: 'youdu-bai-shoubu',
          name: '守簿翁',
          greeting: '本周功簿已经归拢，你可逐项查验。',
        },
        promotion: {
          id: 'youdu-chu-yingui',
          name: '归魂婆婆',
          greeting: '晋升这一关，先要记得自己为何而来。',
        },
      },
    },
    hall: {
      actors: {
        registry: {
          id: 'youdu-luming',
          name: '沈故衣',
          greeting: '你的名字还清楚地留在册上，玉牒和同门名录都可查。',
        },
        stipend: {
          id: 'youdu-fafeng',
          name: '温婆婆',
          greeting: '本周该给你的已经备齐，要先核对也不妨。',
        },
      },
    },
    treasury: {
      actors: {
        keeper: {
          id: 'youdu-shoucang',
          name: '阮秋声',
          greeting: '架上的东西都清点过了，你慢慢看，选定再说。',
        },
      },
    },
    industries: {
      actors: {
        construction: {
          id: 'youdu-zhuming',
          name: '戚百岁',
          greeting: '桥、阁与台上的建设都有记录，你想先问哪一处？',
        },
        donation: {
          id: 'youdu-duwu',
          name: '阿七',
          greeting: '今日选好一处设施，我替你把灵石记入建设簿。',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          id: 'youdu-zhaojuan',
          name: '褚先生',
          greeting: '六卷心法都能查阅，你想先从哪一卷看起？',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          id: 'youdu-yindeng',
          name: '商无咎',
          greeting: '路有来处，也有归处；你想先辨哪一条？',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          id: 'youdu-shihun',
          name: '迟归鹤',
          greeting: '术痕都还留在场中，要调整神通便从当前配置说起。',
        },
        marshal: {
          id: 'youdu-shouchang',
          name: '桑小满',
          greeting: '场地已经安静下来，有小比在身便可开始。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          id: 'youdu-shoudeng',
          name: '宁无恙',
          greeting: '室中一切安稳，想先问灵效，还是现在闭关？',
        },
      },
    },
    alchemy: {
      actors: {
        keeper: {
          id: 'youdu-huansheng',
          name: '白蘅',
          greeting: '香火未断，炉温也合适，要先问灵效还是开炉？',
        },
      },
    },
    refinery: {
      actors: {
        keeper: {
          id: 'youdu-zhentie',
          name: '祝余',
          greeting: '低焰正稳，材料也都归位，要先问灵效还是炼器？',
        },
      },
    },
    spiritVein: {
      actors: {
        keeper: {
          id: 'youdu-tingyin',
          name: '贺寒川',
          greeting: '矿道里没有异动，巡视封签已经备妥。',
        },
        facility: {
          id: 'youdu-heishui-yinmai',
          name: '黑水阴脉',
          greeting: '湿冷岩层间灵光幽微，黑水映不出矿壁的深处。',
        },
      },
    },
    herbGarden: {
      actors: {
        keeper: {
          id: 'youdu-bianhua',
          name: '柳十三',
          greeting: '两岸花叶都安稳，今日长势已经记入值录。',
        },
        facility: {
          id: 'youdu-bian-pu',
          name: '彼岸圃',
          greeting: '深色花叶沿黑水两岸舒展，水气停在叶尖未散。',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          id: 'youdu-shouguan',
          name: '顾长夜',
          greeting: '关前今日无事，来往记录都已经归拢。',
        },
        facility: {
          id: 'youdu-wuri-guan',
          name: '无日关',
          greeting: '三盏魂灯照着关前石路，阶上落叶仍待清理。',
        },
      },
    },
  },
  terms: {
    pathChanges: '道途变化',
    meridianPractice: '七魄参悟',
    meridianLoadout: '参悟方案',
    abilityChanges: '魂术变化',
    returnToAffairs: '返回招魂司',
  },
};
