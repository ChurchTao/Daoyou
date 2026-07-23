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
): SectMapHotspot => ({ id, label, left, top, route, permission, note, facility, visitor });

export const YOUDU_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: YOUDU_SECT_ID,
  onboarding: {
    summary: '黑水照影，幽灯唤魂。你将在敌人仍然站立时，一层层取走支撑其形神的力量。',
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
          id: 'black-water-shadow', title: '黑水有影', scene: '幽都 · 黑水石径',
          body: '你沿北海石径入山。天上没有月，黑水却照出你的脸。水中那张脸比你迟了一息才抬眼。',
          backgroundPosition: '48% 54%', tone: 'stillness',
        },
        {
          id: 'three-calls', title: '三声唤名', scene: '幽都 · 无日关',
          body: '山门内有人依次唤出你的姓名、来处与心中最不愿失去之物。前两声都有回音，第三声落下时，身后的影子轻轻动了一下。',
          speaker: '引路人：“莫回头。能随一声呼唤离身的，未必是鬼，也可能是你自己。”',
          backgroundPosition: '60% 45%', tone: 'mist',
        },
        {
          id: 'seven-lamps', title: '七灯照身', scene: '幽都 · 七魄台',
          body: '七盏灯从暗处逐一亮起。你每走过一盏，脚步便轻一分，直到分不清是身体在前行，还是影子拖着身体。',
          backgroundPosition: '35% 48%', tone: 'stillness',
        },
        {
          id: 'where-soul-returns', title: '魂归何处', scene: '幽都 · 幽都殿',
          body: '殿中没有神像，只有一面黑水。掌门问你：若能唤走仇敌的魂，也能唤回他的魂，你以哪一声为本事？你承认自己尚不知道答案。',
          backgroundPosition: '50% 38%', tone: 'mist',
        },
        {
          id: 'one-sigh-entry', title: '一叹入门', scene: '幽都 · 魂灯前',
          body: '掌门吹灭其中一盏灯，灯焰却出现在你掌心。黑水里的倒影终于与你同时抬头。',
          speaker: '掌门：“先学叹息。唯有一声叹息，最容易让人忘记守住自己的魂。”',
          backgroundPosition: '52% 44%', tone: 'ember',
        },
      ],
    },
  },
  map: {
    image: '/assets/sect/youdu-map.webp',
    alt: '幽都宗门舆图，黑水穿过幽都殿、七魄台、照影场与山中诸院',
    hotspots: [
      hotspot('hall', '幽都殿', '49%', '20%', '/game/sect/hall', 'sect.hall.view', '身份 · 晋升 · 周俸'),
      hotspot('archive', '三魂阁', '25%', '40%', '/game/sect/archive', 'sect.archive.use', '六卷心法', 'archive'),
      hotspot('cliff', '七魄台', '18%', '24%', '/game/sect/enlightenment-cliff', 'sect.enlightenment.use', '道途 · 参悟'),
      hotspot('arena', '照影场', '43%', '57%', '/game/sect/arena', 'sect.arena.use', '神通 · 战术'),
      hotspot('affairs', '招魂司', '34%', '46%', '/game/sect/affairs', 'sect.tasks.use', '日常 · 周常 · 悬赏'),
      hotspot('treasury', '玄冥库', '63%', '68%', '/game/sect/treasury', 'sect.shop.use', '贡献兑换'),
      hotspot('industries', '黑水坊', '48%', '78%', '/game/sect/industries', 'sect.construction.view', '宗门共建'),
      hotspot('cultivation', '返照室', '12%', '62%', '/game/sect/cultivation-room', 'sect.facility.cultivation.use', '聚灵闭关', 'cultivation_room'),
      hotspot('alchemy', '还魂药庐', '73%', '50%', '/game/sect/alchemy', 'sect.facility.alchemy.use', '炼丹', 'workshop'),
      hotspot('refinery', '镇铁炉', '82%', '71%', '/game/sect/refinery', 'sect.facility.refinery.use', '炼器', 'workshop'),
      hotspot('vein', '黑水阴脉', '90%', '44%', '/game/sect/spirit-vein', 'sect.spirit_vein.view', '灵石收益', 'spirit_vein'),
      hotspot('garden', '彼岸圃', '70%', '37%', '/game/sect/herb-garden', 'sect.herb_garden.view', '灵草产出', 'herb_garden'),
      hotspot('gate', '无日关', '49%', '87%', '/game/sect/gate', 'sect.gate.view', '宗门动态', undefined, {
        description: '三盏魂灯在无日关外照出访客影子，守关人只接下姓名与来意相符的拜帖。',
      }),
      hotspot('cave', '寄魂庐', '88%', '31%', '/game/sect/cave', 'sect.cave.view', '弟子居所'),
      {
        id: 'formation', label: '万魂归窍阵', left: '79%', top: '14%',
        permission: 'sect.formation.view', note: '宗门战后续开放', facility: 'formation', locked: true,
        visitor: {
          description: '黑水与魂灯牵引归路，外客只能在灯外辨认阵纹，不能越过无日关。',
        },
      },
    ],
  },
  facilityLabels: {
    archive: '三魂阁', cultivation_room: '返照室', workshop: '镇铁炉',
    alchemy: '还魂药庐', refinery: '镇铁炉',
    spirit_vein: '黑水阴脉', herb_garden: '彼岸圃', formation: '万魂归窍阵',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: { title: '幽都舆图', description: '黑水自山腹流过两岸诸院，灯影与人影总错开半步。', loadingText: '魂灯正沿黑水次第亮起……' },
    hall: { title: '幽都殿', description: '殿中无神像，只有映照姓名、来处与归路的一面黑水。' },
    affairs: { title: '招魂司', description: '门人记录失名者、游魂与界隙回声，也护送愿意归去的魂。' },
    archive: { title: '三魂阁', description: '六卷心法分藏于三层暗阁，书页以魂灯照见。' },
    paths: { title: '七魄台', description: '招魂渡夜与镇魄司命由此分途：一者让黑水漫长，一者令铁钉落准。' },
    arena: { title: '照影场', description: '场中不立木人，只以黑水映出每一门神通落在影上的痕迹。' },
    cultivation: { title: '返照室', description: '一灯一席，修士在寂静中确认三魂七魄仍各安其位。' },
    alchemy: { title: '还魂药庐', description: '返照香与彼岸草分柜存放，药师只治魂魄缝隙，不许强拘生魂。' },
    refinery: { title: '镇铁炉', description: '黑水旧铁在低焰中缓慢成形，专用来定影稳神。' },
    spiritVein: { title: '黑水阴脉', description: '灵石沿湿冷岩层生长，表面映不出开采者的面孔。' },
    herbGarden: { title: '彼岸圃', description: '深色花叶沿黑水两岸生长，供药庐按时采撷。' },
    gate: { title: '无日关', description: '关外不见日月，三盏魂灯为每个归山者留着方向。' },
    cave: { title: '寄魂庐', description: '庐舍门前各悬一灯，灯在便知主人形神安稳。' },
  },
  terms: {
    pathChanges: '道途变化', meridianPractice: '七魄参悟', meridianLoadout: '参悟方案',
    abilityChanges: '魂术变化', returnToAffairs: '返回招魂司',
    sweepActivity: '巡灯照影', sweepCanvasLabel: '巡灯照影游戏画布',
  },
};
