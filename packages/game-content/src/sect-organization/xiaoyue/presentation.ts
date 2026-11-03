import type { SectPresentationTheme } from '@daoyou/game-domain/sects';
import { STANDARD_SECT_PRESENTATION } from '../standard/presentation.js';
import { XIAOYUE_SECT_ID } from './ids.js';

const locationNames: Record<string, string> = {
  hall: '听山堂',
  archive: '百兽阁',
  paths: '观形台',
  arena: '演武坪',
  affairs: '山务堂',
  treasury: '山中宝库',
  industries: '营造院',
  cultivation: '息岩室',
  alchemy: '丹房',
  refinery: '山火坊',
  vein: '崖脉矿场',
  garden: '山草圃',
  gate: '百兽崖山门',
  cave: '弟子岩居',
};

const hotspotPositions: Record<string, { left: string; top: string }> = {
  hall: { left: '50%', top: '17%' },
  archive: { left: '23%', top: '49%' },
  paths: { left: '86%', top: '16%' },
  arena: { left: '15%', top: '28%' },
  affairs: { left: '42%', top: '37%' },
  treasury: { left: '37%', top: '20%' },
  industries: { left: '58%', top: '45%' },
  cultivation: { left: '77%', top: '23%' },
  alchemy: { left: '70%', top: '42%' },
  refinery: { left: '50%', top: '50%' },
  vein: { left: '91%', top: '59%' },
  garden: { left: '83%', top: '37%' },
  gate: { left: '50%', top: '76%' },
  cave: { left: '21%', top: '67%' },
};

export const XIAOYUE_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: XIAOYUE_SECT_ID,
  announcement: '演武坪今日开放试招。门人与灵兽可各按自己的步伐入坪；山中差事仍照常交付。',
  onboarding: {
    summary: '百兽崖与山林万类平等相处，观灵兽之形悟修炼与战法。百相化形修自身兽形，灵兽同契与自己的伙伴并肩进退。',
    traits: ['观形悟法', '百相化形', '灵兽同契'],
    script: {
      id: 'xiaoyue-onboarding',
      title: '入崖先听山',
      theme: 'stillness',
      backdrop: {
        src: '/assets/sect/onboarding/xiaoyue.webp',
        alt: '南疆十万大山的林海与赭色崖壁间，石径通往百兽崖山门',
      },
      acts: [
        {
          id: 'follow-the-ridge',
          title: '沿崖而上',
          scene: '百兽崖 · 山门',
          body: '石径从十万大山的林海攀向崖顶。旧传山洪时，修士循兽群找到高地，兽群也沿修士凿出的石径脱险；百兽崖由此立宗。路边石槽至今为行人与山兽留着清水。',
          speaker: '守门弟子：“崖上万类各有自己的路。先听山，再走你的路。”',
          tone: 'mist',
        },
        {
          id: 'learn-the-form',
          title: '观形入道',
          scene: '百兽崖 · 观形台',
          body: '崖边的山兽伏身跃过裂岩，飞鸟顺风掠过山脊。教习只让你静看它们的筋骨、呼息与落点，再把所悟的形意练回自己身上。',
          speaker: '观形教习：“山林万类皆可为师。先识其息，再学其形。”',
          tone: 'stillness',
        },
        {
          id: 'test-the-breath',
          title: '各有步伐',
          scene: '百兽崖 · 演武坪',
          body: '一名弟子借兽形连击木桩，退开调息；另一名门人与自己的灵兽对望一眼，分别从两侧扑向同一处破绽。灵兽停步时，门人也收势等它。',
          speaker: '演武教习：“修己身要知进退，同行者也要听得见彼此。”',
          tone: 'mist',
        },
        {
          id: 'walk-together',
          title: '同路入山',
          scene: '百兽崖 · 听山堂',
          body: '听山长老将《百兽化形》交予你。堂前刻着崖中旧训：观形、同息、共守山林。门规要弟子尊重灵兽去留，结伴先听其意；平日轮值清山径、护水源。',
          speaker: '听山长老：“百相化形修己身，灵兽同契重相应。先听清彼此的呼息，再择所行。”',
          tone: 'stillness',
        },
      ],
    },
  },
  map: {
    image: '/assets/maps/xiaoyue-ridge.webp',
    alt: '百兽崖的林海与赭石崖壁间，听山堂、演武坪、诸院和山门由盘山石径相连的水墨舆图',
    hotspots: [
      ...STANDARD_SECT_PRESENTATION.map.hotspots.map((hotspot) => ({
        ...hotspot,
        label: locationNames[hotspot.id] ?? hotspot.label,
        ...hotspotPositions[hotspot.id],
        ...(hotspot.id === 'gate' ? {
          visitor: { description: '盘山石径通向百兽崖山门，守门弟子为来客与山兽留出同行的路。' },
        } : {}),
      })),
      {
        id: 'formation',
        label: '护崖石阵',
        facility: 'formation',
        permission: 'sect.formation.view',
        left: '91%',
        top: '72%',
        note: '宗门战后续开放',
        locked: true,
        visitor: { description: '崖壁间的护崖石阵尚未开放，外客可从山径远望。' },
      },
    ],
  },
  facilityLabels: {
    archive: '百兽阁',
    cultivation_room: '息岩室',
    workshop: '山火坊',
    spirit_vein: '崖脉矿场',
    herb_garden: '山草圃',
    formation: '护崖石阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: { title: '百兽崖', description: '林海与赭壁间的山径通向各处院落，门人与灵兽各行其路，也常结伴同行。' },
    hall: { title: '听山堂', description: '堂前刻着观形、同息、共守山林的旧训，掌籍门人在此经办弟子名册、晋升与周俸。' },
    affairs: { title: '山务堂', description: '清理山径、修缮共用水槽等山中日常，与下山差事一同在此登记。' },
    archive: { title: '百兽阁', description: '六门心法分架收藏，守阁教习引弟子从山林万类的形与息中悟法。' },
    paths: { title: '观形台', description: '在百相化形与灵兽同契之间，参悟自身演化兽形或与伙伴相应的战法。' },
    arena: { title: '演武坪', description: '门人与灵兽按各自步伐试招，在木桩和同门小比中检验攻守与默契。' },
    treasury: { title: '山中宝库' },
    industries: { title: '营造院' },
    cultivation: { title: '息岩室', description: '崖岩隔去山风，可在静处调息修炼。' },
    refinery: { title: '山火坊' },
    spiritVein: { title: '崖脉矿场' },
    herbGarden: { title: '山草圃' },
    gate: { title: '百兽崖山门' },
    cave: { title: '弟子岩居' },
  },
  rooms: {
    hall: {
      actors: {
        registry: { name: '掌籍门人', greeting: '弟子名册已经备妥，今日想经办哪一项？' },
        stipend: { name: '司俸门人', greeting: '本周俸给已记入册，可在此核领。' },
      },
    },
    archive: {
      actors: {
        keeper: { name: '守阁教习', greeting: '六门心法各取山林一份形意，今日想先观哪一门？' },
      },
    },
    paths: {
      actors: {
        guide: { name: '观形长老', greeting: '百相化形修己，灵兽同契同行。你想先参悟哪一脉？' },
      },
    },
    arena: {
      actors: {
        instructor: { name: '演武教习', greeting: '观形要知出手与回气，结伴要听见彼此。先理清神通与战术吧。' },
        marshal: { name: '值坪门人', greeting: '演武坪已经清过场，有小比记录便可开场。' },
      },
    },
    cultivation: {
      actors: {
        keeper: { name: '守室门人', greeting: '息岩室已备妥，可先查灵效，再入内调息。' },
      },
    },
    gate: {
      actors: {
        keeper: { name: '守门弟子', greeting: '山门往来与山中消息，都记在这里；路遇兽群，记得留出归林的道。' },
        facility: { name: '百兽崖山门', greeting: '赭色石阶沿崖壁盘旋，林间的兽迹与人的脚印同到山门。' },
      },
    },
  },
  terms: {
    pathChanges: '所悟变化',
    meridianPractice: '观形参悟',
    meridianLoadout: '参悟方案',
    abilityChanges: '战法变化',
    returnToAffairs: '返回山务堂',
  },
};
