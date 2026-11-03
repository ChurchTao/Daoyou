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

export const WANQIAO_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: WANQIAO_SECT_ID,
  announcement:
    '藏音阁新录了几处山涧清声，诸位同门可往静听。山中诸务照常交付，归来时也请带回沿途所闻。',
  onboarding: {
    summary:
      '从石隙、竹窍与呼吸中听取天地之声，修众窍共鸣与余音入微之法。心中有空处，方能听见新的变化。',
    traits: ['听风观窍', '虚而能应', '余音入微'],
    script: {
      id: 'wanqiao-onboarding',
      title: '一声从何而来',
      theme: 'stillness',
      backdrop: {
        src: '/assets/sect/onboarding/wanqiao.webp',
        alt: '万窍山空谷中山石多隙，竹林松树与静亭相依，横笛静置石上',
      },
      acts: [
        {
          id: 'hear-the-valley',
          title: '谷中有声',
          scene: '万窍山 · 山门',
          body: '山径上无人奏乐，却有一长一短的声音从谷底传来。引路门人领你走近两块相倚的山石，指了指石间窄隙。来风穿过那里，便成了方才听见的声音。',
          speaker: '引路门人：“先停一停，听它从何处来。”',
          tone: 'mist',
        },
        {
          id: 'leave-a-hollow',
          title: '竹中有空',
          scene: '万窍山 · 听风堂',
          body: '长老递来一段中空的竹管。你按住一孔，声音低下去；松开手指，另一声随之而起。他将一根实心竹枝并放案边，示意你再试。竹枝仍是竹枝，案前却静了下来。',
          speaker: '听风长老：“竹有窍，才容得下这一声。人修行，也须留些余地。”',
          tone: 'stillness',
        },
        {
          id: 'answer-among-hollows',
          title: '众窍相应',
          scene: '万窍山 · 鸣石坪',
          body: '坪中门人吹出一缕清音，四周鸣石先后应答。另一人抬手止住箫声，石上的细纹却仍在轻颤。你凝神去听，那一点余音像是落在胸中，片刻后才渐渐散去。',
          speaker: '传音师：“一声可以遍应众窍，也可以只留在细隙。天籁与入微，各有可听之处。”',
          tone: 'mist',
        },
        {
          id: 'listen-with-room',
          title: '心中留白',
          scene: '万窍山 · 观窍台',
          body: '长老将《听万窍》交到你手中，请你在册上记下今日所闻。你写过风、石与竹，又空出半页。山谷仍有声响传来，这一次，你没有急着替它命名。',
          speaker: '听风长老：“今日听见的，先记下。还未听见的，留待明日。”',
          tone: 'stillness',
        },
      ],
    },
  },
  map: {
    alt: '万窍山设施导航',
    hotspots: [
      ...STANDARD_SECT_PRESENTATION.map.hotspots.map((hotspot) => ({
        ...hotspot,
        label: locationNames[hotspot.id] ?? hotspot.label,
        ...(hotspot.id === 'gate' ? {
          visitor: { description: '石径穿过竹林与鸣石，引路门人在山门前为外客登记来意。' },
        } : {}),
      })),
      {
        id: 'formation',
        label: '护山音阵',
        facility: 'formation',
        permission: 'sect.formation.view',
        left: '0',
        top: '0',
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
