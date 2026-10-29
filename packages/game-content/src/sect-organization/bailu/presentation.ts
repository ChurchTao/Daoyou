import type { SectPresentationTheme } from '@daoyou/game-domain/sects';
import { STANDARD_SECT_PRESENTATION } from '../standard/presentation.js';
import { BAILU_SECT_ID } from './ids.js';

const locationNames: Record<string, string> = {
  hall: '白鹿堂',
  archive: '藏书楼',
  paths: '问学台',
  arena: '论道场',
  affairs: '司务堂',
  treasury: '书院宝库',
  industries: '庶务院',
  cultivation: '存诚斋',
  alchemy: '丹房',
  refinery: '百工坊',
  vein: '青石灵脉',
  garden: '芝兰圃',
  gate: '白鹿山门',
  cave: '学舍',
};

const locationPositions: Record<string, { left: string; top: string }> = {
  hall: { left: '50%', top: '35%' },
  archive: { left: '51%', top: '13%' },
  paths: { left: '21%', top: '22%' },
  arena: { left: '80%', top: '42%' },
  affairs: { left: '36%', top: '56%' },
  treasury: { left: '75%', top: '21%' },
  industries: { left: '78%', top: '61%' },
  cultivation: { left: '17%', top: '45%' },
  alchemy: { left: '24%', top: '66%' },
  refinery: { left: '86%', top: '71%' },
  vein: { left: '8%', top: '32%' },
  garden: { left: '11%', top: '75%' },
  gate: { left: '49%', top: '80%' },
  cave: { left: '63%', top: '68%' },
};

export const BAILU_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: BAILU_SECT_ID,
  announcement:
    '藏书楼新收数卷游学见闻，诸生可往查阅。下山行走当记所见，归院后交司务堂存录。',
  onboarding: {
    summary:
      '以经义修心，以浩气立身。修习言出法随，或以正言约束敌手，或以文章显化攻势。',
    traits: ['浩然养气', '言出法随', '文章显圣'],
    script: {
      id: 'bailu-onboarding',
      title: '一言立身',
      theme: 'stillness',
      backdrop: {
        src: '/assets/sect/onboarding/bailu-v1.webp',
        alt: '白鹿书院松溪石桥前，山长在学籍案旁迎接新学子，远处讲堂、问学台与论道场间诸生读书试法',
      },
      acts: [
        {
          id: 'hear-the-reading',
          title: '山门闻书',
          scene: '白鹿书院 · 山门',
          body: '石阶尽头传来诵书声，忽而整齐，忽而有人停下争辩。引路的学子替你拂去肩头落叶，领你穿过松庭。院中没有高悬的兵刃，只有几卷摊开的旧书。',
          speaker:
            '引路学子：“先入院听一听。这里读过的道理，终要走到山下去用。”',
          backgroundPosition: '50% 72%',
          tone: 'mist',
        },
        {
          id: 'ask-before-speaking',
          title: '先问一句',
          scene: '白鹿书院 · 白鹿堂',
          body: '山长未问你能诵多少经文，只指着案前一盏将熄的灯：若一言便能使人俯首，该如何知道自己所言无误？你沉默片刻，承认仍须求证。',
          speaker: '山长：“肯再问一句，便还有读书的地方。”',
          backgroundPosition: '53% 37%',
          tone: 'stillness',
        },
        {
          id: 'words-have-weight',
          title: '言有其重',
          scene: '白鹿书院 · 问学台',
          body: '教习向一名持剑学子颔首。剑势才起，他只说了一声“定身！”浩气随声落下，执剑的手停在半空。片刻后言令散去，二人重新作揖，各自说出方才的破绽。',
          speaker:
            '教习：“正言可以制敌，也须容人答辩。言出之前，先知道自己要止住什么。”',
          backgroundPosition: '20% 44%',
          tone: 'steel',
        },
        {
          id: 'writing-takes-form',
          title: '文章有势',
          scene: '白鹿书院 · 论道场',
          body: '另一侧有人以指代笔，将游学所见写在空中。最后一字落定，他扬声道“破邪！”墨迹随浩气凝成辞锋，击散场中的试法石影。远处诸生并未停笔，仍在补记这一式的得失。',
          speaker:
            '教习：“正言执律，文章有势。路有两条，养的都是胸中这一口正气。”',
          backgroundPosition: '84% 46%',
          tone: 'ember',
        },
        {
          id: 'write-your-name',
          title: '入院立身',
          scene: '白鹿书院 · 学籍案前',
          body: '掌籍先生递来一卷空白册页。你写下自己的名字，又写下今日尚未想明白的问题。山长将《白鹿正学》放在案边，示意你带着它去寻自己的答案。',
          speaker:
            '山长：“从今日起，你的言行也是书院的一页。愿你所言，担得起自己所行。”',
          backgroundPosition: '68% 65%',
          tone: 'stillness',
        },
      ],
    },
  },
  map: {
    image: '/assets/maps/bailu-academy-v1.webp',
    alt: '白鹿书院松溪舆图，中央白鹿堂连接藏书楼、临水问学台与论道场，山门石桥、学舍和芝兰圃分布其间',
    aspectRatio: 1536 / 1024,
    hotspots: [
      ...STANDARD_SECT_PRESENTATION.map.hotspots.map((hotspot) => ({
        ...hotspot,
        label: locationNames[hotspot.id] ?? hotspot.label,
        ...locationPositions[hotspot.id],
        ...(hotspot.id === 'gate'
          ? {
              visitor: {
                description:
                  '值门学子在松庭前为外客登记来意，书声从院中隐约传来。',
              },
            }
          : {}),
      })),
      {
        id: 'formation',
        label: '护院大阵',
        facility: 'formation',
        permission: 'sect.formation.view',
        left: '92%',
        top: '53%',
        note: '宗门战后续开放',
        locked: true,
        visitor: { description: '青石阵纹环绕院墙，外客可在阵外观望。' },
      },
    ],
  },
  facilityLabels: {
    archive: '藏书楼',
    cultivation_room: '存诚斋',
    workshop: '百工坊',
    spirit_vein: '青石灵脉',
    herb_garden: '芝兰圃',
    formation: '护院大阵',
  },
  scenes: {
    map: { title: '白鹿书院', description: '松庭与学舍之间，诸生各安其业。' },
    hall: {
      title: '白鹿堂',
      description: '掌籍先生候在堂前，经办学籍、晋升与周俸。',
    },
    affairs: {
      title: '司务堂',
      description: '游学差事与院中诸务，都在此处登记交付。',
    },
    archive: {
      title: '藏书楼',
      description: '六部传承分架而藏，授业先生为你展开所修经卷。',
    },
    paths: {
      title: '问学台',
      description: '诸生在此辨明所学，参悟正言与文章的不同用处。',
    },
    arena: {
      title: '论道场',
      description: '场中留有试法石影，可整理神通，也可与同门切磋。',
    },
    treasury: { title: '书院宝库' },
    industries: { title: '庶务院' },
    cultivation: {
      title: '存诚斋',
      description: '松声隔窗而来，静斋可供收心养气。',
    },
    refinery: { title: '百工坊' },
    spiritVein: { title: '青石灵脉' },
    herbGarden: { title: '芝兰圃' },
    gate: { title: '白鹿山门' },
    cave: { title: '学舍' },
  },
  rooms: {
    hall: {
      actors: {
        registry: {
          name: '掌籍先生',
          greeting: '学籍与修习记录都已收齐，今日想经办哪一项？',
        },
        stipend: {
          name: '典俸先生',
          greeting: '本周俸给已经记册，可在这里核领。',
        },
      },
    },
    archive: {
      actors: {
        keeper: {
          name: '授业先生',
          greeting: '修习须从已有根基往下读，先展开你的六部经卷吧。',
        },
      },
    },
    paths: {
      actors: {
        guide: {
          name: '问学先生',
          greeting: '正言执律，浩气文章，你想从哪一处继续求索？',
        },
      },
    },
    arena: {
      actors: {
        instructor: {
          name: '论道教习',
          greeting: '言令各有所用，先整理神通与战术，再到场中试验。',
        },
        marshal: {
          name: '值场学正',
          greeting: '论道场已备妥，有小比记录便可开场。',
        },
      },
    },
    cultivation: {
      actors: {
        keeper: {
          name: '养气先生',
          greeting: '静斋已经扫净，要先查灵效，还是收心静修？',
        },
      },
    },
    gate: {
      actors: {
        keeper: {
          name: '值门学子',
          greeting: '山门往来与院中消息都记在这里。',
        },
        facility: {
          name: '白鹿山门',
          greeting: '风过松庭，石阶上又落了几片新叶。',
        },
      },
    },
  },
  terms: {
    pathChanges: '所学变化',
    meridianPractice: '问学进度',
    meridianLoadout: '参悟方案',
    abilityChanges: '言法变化',
    returnToAffairs: '返回司务堂',
  },
};
