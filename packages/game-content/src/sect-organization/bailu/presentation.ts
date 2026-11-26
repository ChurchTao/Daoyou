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
