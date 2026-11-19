import type { SectPresentationTheme } from '@daoyou/game-domain/sects';
import { STANDARD_SECT_PRESENTATION } from '../standard/presentation.js';
import { WANQIAO_SECT_ID } from './ids.js';

const locationNames: Record<string, string> = {
  hall: '听风堂',
  archive: '藏音阁',
  paths: '观窍台',
  arena: '鸣石坪',
  affairs: '山务堂',
  treasury: '山中宝库',
  industries: '营造院',
  cultivation: '息心庐',
  alchemy: '丹房',
  refinery: '百工坊',
  vein: '石隙灵脉',
  garden: '草木园',
  gate: '万窍山门',
  cave: '静庐',
};

const hotspotPositions: Record<string, { left: string; top: string }> = {
  hall: { left: '45%', top: '21%' },
  archive: { left: '18%', top: '21%' },
  paths: { left: '75%', top: '12%' },
  arena: { left: '23%', top: '45%' },
  affairs: { left: '44%', top: '40%' },
  treasury: { left: '52%', top: '31%' },
  industries: { left: '65%', top: '42%' },
  cultivation: { left: '14%', top: '67%' },
  alchemy: { left: '71%', top: '34%' },
  refinery: { left: '79%', top: '43%' },
  vein: { left: '92%', top: '53%' },
  garden: { left: '68%', top: '68%' },
  gate: { left: '51%', top: '83%' },
  cave: { left: '24%', top: '74%' },
};

export const WANQIAO_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: WANQIAO_SECT_ID,
  announcement:
    '藏音阁新录了几处山涧清声，诸位同门可往静听。山中诸务照常交付，归来时也请带回沿途所闻。',
  map: {
    image: '/assets/sect/wanqiao-map.webp',
    alt: '万窍山洞石、竹林与山涧间，听风堂、鸣石坪、诸院和山门由石径相连的水墨鸟瞰图',
    hotspots: [
      ...STANDARD_SECT_PRESENTATION.map.hotspots.map((hotspot) => ({
        ...hotspot,
        label: locationNames[hotspot.id] ?? hotspot.label,
        ...hotspotPositions[hotspot.id],
        ...(hotspot.id === 'gate' ? {
          visitor: { description: '石径穿过竹林与鸣石，引路门人在山门前为外客登记来意。' },
        } : {}),
      })),
      {
        id: 'formation',
        label: '护山音阵',
        facility: 'formation',
        permission: 'sect.formation.view',
        left: '91%',
        top: '21%',
        note: '宗门战后续开放',
        locked: true,
        visitor: { description: '山谷诸窍与阵中鸣石遥相应答，外客可在阵外静听山中的回声。' },
      },
    ],
  },
  facilityLabels: {
    archive: '藏音阁',
    cultivation_room: '息心庐',
    workshop: '百工坊',
    spirit_vein: '石隙灵脉',
    herb_garden: '草木园',
    formation: '护山音阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: { title: '万窍山', description: '风从石隙入山，众声各有来处。' },
    hall: { title: '听风堂', description: '掌籍门人在堂前经办弟子名册、晋升与周俸。' },
    affairs: { title: '山务堂', description: '山中日常与下山差事，都在此处登记交付。' },
    archive: { title: '藏音阁', description: '六门心法与历代听风手记分架收藏，传音师在此指点修习。' },
    paths: { title: '观窍台', description: '循众声辨变化，参悟天籁与入微的不同用处。' },
    arena: { title: '鸣石坪', description: '鸣石相应，可在此整理神通、检验战术，与同门试法。' },
    treasury: { title: '山中宝库' },
    industries: { title: '营造院' },
    cultivation: { title: '息心庐', description: '庐外松声细长，可在静处调息养神。' },
    refinery: { title: '百工坊' },
    spiritVein: { title: '石隙灵脉' },
    herbGarden: { title: '草木园' },
    gate: { title: '万窍山门' },
    cave: { title: '静庐' },
  },
  rooms: {
    hall: {
      actors: {
        registry: { name: '掌籍门人', greeting: '弟子名册已备妥，今日想经办哪一项？' },
        stipend: { name: '司俸门人', greeting: '本周俸给已经记下，可在此核领。' },
      },
    },
    archive: {
      actors: {
        keeper: { name: '传音师', greeting: '先听一听自己的气息，再看今日要从哪门心法修起。' },
      },
    },
    paths: {
      actors: {
        guide: { name: '听风长老', greeting: '众窍相应，余音入微，今日想往哪一处继续听？' },
      },
    },
    arena: {
      actors: {
        instructor: { name: '试音师', greeting: '先理清每一声的用处，再试着将它们接在一起。' },
        marshal: { name: '值坪门人', greeting: '鸣石坪已备妥，有小比记录便可开场。' },
      },
    },
    cultivation: {
      actors: {
        keeper: { name: '守庐门人', greeting: '静庐已经扫净，可先查灵效，再入内调息。' },
      },
    },
    gate: {
      actors: {
        keeper: { name: '引路门人', greeting: '山门往来与山中消息，都记在这里。' },
        facility: { name: '万窍山门', greeting: '石隙中清声时断时续，竹影落在入山的小径上。' },
      },
    },
  },
  terms: {
    pathChanges: '所悟变化',
    meridianPractice: '观窍进度',
    meridianLoadout: '参悟方案',
    abilityChanges: '音法变化',
    returnToAffairs: '返回山务堂',
  },
};
