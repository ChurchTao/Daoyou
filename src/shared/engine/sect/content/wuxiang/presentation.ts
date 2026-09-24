import type { SectMapHotspot, SectPresentationTheme } from '../../core';
import { WUXIANG_SECT_ID } from './ids';

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

export const WUXIANG_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: WUXIANG_SECT_ID,
  announcement:
    '晨钟后将开一场无相问心会，愿照见本念者可赴旧铜镜前静坐，不拘佛魔二途。',
  onboarding: {
    summary: '把色身视作道场，在佛相、魔相与无相之间照见苦、承受苦、横渡苦。',
    traits: ['佛魔同修', '以身渡厄', '临危转念'],
    script: {
      id: 'wuxiang-onboarding',
      title: '无相照身',
      theme: 'ember',
      backdrop: {
        src: '/assets/sect/onboarding/wuxiang.webp',
        alt: '黑白双峰与血莲池之间，一座未合圆环形山门立在雾中',
      },
      acts: [
        {
          id: 'nondual-gate',
          title: '不二门',
          scene: '无相禅宗 · 不二门',
          body: '山门没有门扇，门额只留着一道未合的圆。钟声越过黑白双峰，也越过山间那片暗红莲池；知客僧向你合掌。',
          speaker: '知客僧：“不必先证明清净，肯照见自己，便可入门。”',
          backgroundPosition: '52% 40%',
          tone: 'stillness',
        },
        {
          id: 'bronze-mirror',
          title: '铜镜照身',
          scene: '无相禅宗 · 旧镜前',
          body: '旧铜镜里没有佛光，也没有魔影，只有一路跋涉至此的你。灯火照过衣上的尘，也照过每一道尚未说出口的迟疑。',
          speaker: '知客僧：“你怕的是痛苦，还是那个会在痛苦里变得陌生的自己？”',
          backgroundPosition: '72% 56%',
          tone: 'stillness',
        },
        {
          id: 'buddha-and-demon',
          title: '佛与魔',
          scene: '无相禅宗 · 问身场',
          body: '白衣门人迎着来势，把因果稳稳留在身前；红衣门人踏进险境，以自身作舟，强渡将倾的一刻。这里的佛与魔不是善恶两张面具，而是面对苦难时都要付诸本心的选择。',
          backgroundPosition: '40% 48%',
          tone: 'ember',
        },
        {
          id: 'body-as-dojo',
          title: '色身道场',
          scene: '无相禅宗 · 诸院',
          body: '药师从血莲池采露，火供院的锤声慢而不绝，面壁窟里有人静坐到天明。无相门人不厌弃身体，也不纵容欲念；皮囊会痛、会倦、会留下痕迹，正因如此，它才是最诚实的道场。',
          backgroundPosition: '30% 58%',
          tone: 'mist',
        },
        {
          id: 'unfinished-circle',
          title: '圆未合',
          scene: '无相禅宗 · 名牒前',
          body: '知客僧在你的名牒旁落下一点墨。钟声再起，那道未完的圆仿佛正等你迈入其中。',
          speaker:
            '知客僧：“能见诸苦，不必逃；能借诸苦，不可欺心。最后这一笔，由你自己来合。”',
          backgroundPosition: '52% 35%',
          tone: 'ember',
        },
      ],
    },
  },
  map: {
    image: '/assets/sect/wuxiang-map.webp',
    alt: '无相禅宗黑白双峰、血池、佛窟与诸院落的水墨鸟瞰图',
    hotspots: [
      hotspot(
        'hall',
        '无相殿',
        '48%',
        '22%',
        '/game/sect/hall',
        'sect.hall.view',
        '身份 · 同门 · 周俸',
      ),
      hotspot(
        'archive',
        '贝叶藏',
        '24%',
        '45%',
        '/game/sect/archive',
        'sect.archive.use',
        '心法研习',
        'archive',
      ),
      hotspot(
        'cliff',
        '照业壁',
        '18%',
        '24%',
        '/game/sect/enlightenment-cliff',
        'sect.enlightenment.use',
        '流派 · 参悟',
      ),
      hotspot(
        'arena',
        '问身场',
        '45%',
        '57%',
        '/game/sect/arena',
        'sect.arena.use',
        '神通 · 战术 · 小比',
      ),
      hotspot(
        'affairs',
        '知客寮',
        '35%',
        '46%',
        '/game/sect/affairs',
        'sect.tasks.use',
        '日常 · 周常 · 晋升',
      ),
      hotspot(
        'treasury',
        '七宝库',
        '61%',
        '68%',
        '/game/sect/treasury',
        'sect.shop.use',
        '贡献兑换',
      ),
      hotspot(
        'industries',
        '营造院',
        '49%',
        '78%',
        '/game/sect/industries',
        'sect.construction.view',
        '设施建设 · 灵石捐献',
      ),
      hotspot(
        'cultivation',
        '止观室',
        '13%',
        '62%',
        '/game/sect/cultivation-room',
        'sect.facility.cultivation.use',
        '闭关修炼 · 设施灵效',
        'cultivation_room',
      ),
      hotspot(
        'alchemy',
        '药师寮',
        '72%',
        '51%',
        '/game/sect/alchemy',
        'sect.facility.alchemy.use',
        '炼丹 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'refinery',
        '火供院',
        '81%',
        '71%',
        '/game/sect/refinery',
        'sect.facility.refinery.use',
        '炼器 · 设施灵效',
        'workshop',
      ),
      hotspot(
        'vein',
        '骨玉窟',
        '90%',
        '45%',
        '/game/sect/spirit-vein',
        'sect.spirit_vein.view',
        '矿场巡视 · 灵石收益 · 采矿',
        'spirit_vein',
      ),
      hotspot(
        'garden',
        '血莲池',
        '70%',
        '39%',
        '/game/sect/herb-garden',
        'sect.herb_garden.view',
        '草木长势 · 产出待开放',
        'herb_garden',
      ),
      hotspot(
        'gate',
        '不二门',
        '49%',
        '85%',
        '/game/sect/gate',
        'sect.gate.view',
        '山门动态 · 清扫差事',
        undefined,
        {
          description: '不二门没有门扇，知客僧在未合圆环下为外客验明拜帖。',
        },
      ),
      hotspot(
        'cave',
        '面壁窟',
        '88%',
        '36%',
        '/game/sect/cave',
        'sect.cave.view',
        '弟子居所',
      ),
      {
        id: 'formation',
        label: '两界曼荼罗',
        left: '80%',
        top: '13%',
        permission: 'sect.formation.view',
        note: '宗门战后续开放',
        facility: 'formation',
        locked: true,
        visitor: {
          description:
            '黑白双峰与血莲池共同构成阵势，来客立于界外，只能看见未合圆环缓慢转动。',
        },
      },
    ],
  },
  facilityLabels: {
    archive: '贝叶藏',
    cultivation_room: '止观室',
    workshop: '火供院',
    spirit_vein: '骨玉窟',
    herb_garden: '血莲池',
    formation: '两界曼荼罗',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: {
      title: '无相禅宗舆图',
      description:
        '黑白二峰隔血池相望，诸院不分佛魔，只依门人当下一念显出不同面目。',
      loadingText: '钟声正从血池上渡来……',
    },
    hall: {
      title: '无相殿',
      description:
        '殿中不塑金身，只有一面照见来者全身的旧铜镜；身份玉牒与周俸名册置于镜下。',
    },
    affairs: {
      title: '知客寮',
      description:
        '晨钟后三炷香内，新差事会被写上白榜；接下便是今日与自身色身结下的因。',
    },
    archive: {
      title: '贝叶藏',
      description:
        '六卷心法分别藏在六只旧木匣中，贝叶上既有朱砂佛偈，也有后来人以血补下的旁注。',
    },
    paths: {
      title: '照业壁',
      description:
        '石壁正面如镜，背面焦黑。两条道途的痕迹交映于此，等待弟子静心参悟。',
    },
    arena: {
      title: '问身场',
      description:
        '场中木人不会退让。佛相留下因，魔相兑现果，无相只在心念圆满的一念间显现。',
    },
    cultivation: {
      title: '止观室',
      description:
        '室内只容一席一灯。呼吸落在皮肉，念头落在灯芯，直到两者都不再需要命名。',
    },
    alchemy: {
      title: '药师寮',
      description: '血莲、骨玉与寻常灵草分柜存放，药师只问药性，不问净秽。',
    },
    refinery: {
      title: '火供院',
      description:
        '炉火映出忿怒相，锤声却始终缓慢；每一件法器都要在火中去掉多余的名字。',
    },
    spiritVein: {
      title: '骨玉窟',
      description: '白色矿髓沿黑岩生长，如同山腹中的巨大骨骼。',
    },
    herbGarden: {
      title: '血莲池',
      description: '暗红池水并无腥气，莲叶托着晨露；药田产出玩法后续开放。',
    },
    gate: {
      title: '不二门',
      description:
        '门额只有一道未写完的圆。来者从哪一侧入门，都由同一道钟声迎接。',
    },
    cave: {
      title: '面壁窟',
      description: '石窟里没有装饰，只有前人留下的坐痕与指印。',
    },
  },
  rooms: {
    affairs: {
      description:
        '晨钟余音尚在，白榜上的差事由三位僧人分掌；领下一事，便结下一段今日之因。',
      actors: {
        daily: {
          id: 'wuxiang-mingchen',
          name: '法明',
          greeting: '白榜上的日务都在这里，肯做哪一件便说。',
        },
        weekly: {
          id: 'wuxiang-zhaoye',
          name: '慧觉',
          greeting: '功簿只记所行，不替人评说，你可自行查问。',
        },
        promotion: {
          id: 'wuxiang-due',
          name: '空慈方丈',
          greeting: '要过此关，先要肯照见自己带来的业。',
        },
      },
    },
    hall: {
      actors: {
        registry: {
          id: 'wuxiang-huiming',
          name: '慧澄',
          greeting: '玉牒与僧录皆在案前，想查哪一项便问。',
        },
        stipend: {
          id: 'wuxiang-mingji',
          name: '明济',
          greeting: '本周供养已经分定，领取之前也可先核对。',
        },
      },
    },
    treasury: {
      actors: {
        keeper: {
          id: 'wuxiang-kongzang',
          name: '寂照禅师',
          greeting: '诸物各待其用，你想看哪一件？',
        },
      },
    },
    industries: {
      actors: {
        construction: {
          id: 'wuxiang-mingzhu',
          name: '行深',
          greeting: '一砖一木皆有来处，各处建设可逐项说与你听。',
        },
        donation: {
          id: 'wuxiang-xingcang',
          name: '明简',
          greeting: '今日可择一处设施布施灵石，再记入册中。',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          id: 'wuxiang-kongdu',
          name: '空渡禅师',
          greeting: '贝叶六匣都在这里，你想先读哪一卷？',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          id: 'wuxiang-huizhao',
          name: '慧照',
          greeting: '壁有明暗两面，你想先照见哪一条道途？',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          id: 'wuxiang-jiefeng',
          name: '法忍禅师',
          greeting: '神通发于身心，若要调整，先看你当下如何运用。',
        },
        marshal: {
          id: 'wuxiang-huiwu',
          name: '行觉',
          greeting: '木人已经归位，有小比在身便可入场。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          id: 'wuxiang-zhiguan',
          name: '寂然禅师',
          greeting: '一席一灯都已备好，想先问灵效，还是就此入静？',
        },
      },
    },
    alchemy: {
      actors: {
        keeper: {
          id: 'wuxiang-faming-yaoshi',
          name: '明恕',
          greeting: '药性无分净秽，炉火正稳，要问灵效还是开炉？',
        },
      },
    },
    refinery: {
      actors: {
        keeper: {
          id: 'wuxiang-huoyuan',
          name: '法圆',
          greeting: '火候已足，材料也可查验，要问灵效还是炼器？',
        },
      },
    },
    spiritVein: {
      actors: {
        keeper: {
          id: 'wuxiang-shouyu',
          name: '慧海',
          greeting: '窟中今日平稳，巡视封签已经放在案前。',
        },
        facility: {
          id: 'wuxiang-guyu-ku',
          name: '骨玉窟',
          greeting: '白色矿髓沿黑岩静静生长，窟中脉息未见异动。',
        },
      },
    },
    herbGarden: {
      actors: {
        keeper: {
          id: 'wuxiang-huilian',
          name: '行愿',
          greeting: '池水无波，草木各循时生长，今日长势已经记下。',
        },
        facility: {
          id: 'wuxiang-xuelian-chi',
          name: '血莲池',
          greeting: '暗红池水静映晨光，莲叶托着露珠缓缓舒展。',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          id: 'wuxiang-mingmen',
          name: '道安禅师',
          greeting: '钟声已过，今日来往与山门近况都可在此问。',
        },
        facility: {
          id: 'wuxiang-buer-men',
          name: '不二门',
          greeting: '未合的圆环立在雾中，门前石阶散着新落的叶片。',
        },
      },
    },
  },
  terms: {
    pathChanges: '道途变化',
    meridianPractice: '照身参悟',
    meridianLoadout: '参悟方案',
    abilityChanges: '三相神通',
    returnToAffairs: '返回知客寮',
  },
};
