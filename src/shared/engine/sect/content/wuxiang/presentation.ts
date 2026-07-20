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
): SectMapHotspot => ({ id, label, left, top, route, permission, note, facility });

export const WUXIANG_SECT_PRESENTATION: SectPresentationTheme = {
  sectId: WUXIANG_SECT_ID,
  map: {
    image: '/assets/sect/wuxiang-map.webp',
    alt: '无相禅宗黑白双峰、血池、佛窟与诸院落的水墨鸟瞰图',
    hotspots: [
      hotspot('hall', '无相殿', '48%', '22%', '/game/sect/hall', 'sect.hall.view', '身份 · 晋升 · 周俸'),
      hotspot('archive', '贝叶藏', '24%', '45%', '/game/sect/archive', 'sect.archive.use', '六卷心法', 'archive'),
      hotspot('cliff', '照业壁', '18%', '24%', '/game/sect/enlightenment-cliff', 'sect.enlightenment.use', '道途 · 参悟'),
      hotspot('arena', '问身场', '45%', '57%', '/game/sect/arena', 'sect.arena.use', '神通 · 战术'),
      hotspot('affairs', '知客寮', '35%', '46%', '/game/sect/affairs', 'sect.tasks.use', '日常 · 周常 · 悬赏'),
      hotspot('treasury', '七宝库', '61%', '68%', '/game/sect/treasury', 'sect.shop.use', '贡献兑换'),
      hotspot('industries', '营造院', '49%', '78%', '/game/sect/industries', 'sect.construction.view', '宗门共建'),
      hotspot('cultivation', '止观室', '13%', '62%', '/game/sect/cultivation-room', 'sect.facility.cultivation.use', '止观闭关', 'cultivation_room'),
      hotspot('alchemy', '药师寮', '72%', '51%', '/game/sect/alchemy', 'sect.facility.alchemy.use', '血莲入药', 'workshop'),
      hotspot('refinery', '火供院', '81%', '71%', '/game/sect/refinery', 'sect.facility.refinery.use', '白骨炼器', 'workshop'),
      hotspot('vein', '骨玉窟', '90%', '45%', '/game/sect/spirit-vein', 'sect.spirit_vein.view', '灵石俸禄加成', 'spirit_vein'),
      hotspot('garden', '血莲池', '70%', '39%', '/game/sect/herb-garden', 'sect.herb_garden.view', '每周灵草产出', 'herb_garden'),
      hotspot('gate', '不二门', '49%', '85%', '/game/sect/gate', 'sect.gate.view', '宗门动态'),
      hotspot('cave', '面壁窟', '88%', '36%', '/game/sect/cave', 'sect.cave.view', '内门弟子居所'),
      { id: 'formation', label: '两界曼荼罗', left: '80%', top: '13%', permission: 'sect.formation.view', note: '宗门战后续开放', facility: 'formation', locked: true },
    ],
  },
  facilityLabels: {
    archive: '贝叶藏', cultivation_room: '止观室', workshop: '火供院',
    spirit_vein: '骨玉窟', herb_garden: '血莲池', formation: '两界曼荼罗',
  },
  lockedFacilities: ['formation'],
  scenes: {
    map: { title: '无相禅宗舆图', description: '黑白二峰隔血池相望，诸院不分佛魔，只依门人当下一念显出不同面目。', loadingText: '钟声正从血池上渡来……' },
    hall: { title: '无相殿', description: '殿中不塑金身，只有一面照见来者全身的旧铜镜；身份玉牒与周俸名册置于镜下。' },
    affairs: { title: '知客寮', description: '晨钟后三炷香内，新差事会被写上白榜；接下便是今日与自身色身结下的因。' },
    archive: { title: '贝叶藏', description: '六卷心法分别藏在六只旧木匣中，贝叶上既有朱砂佛偈，也有后来人以血补下的旁注。' },
    paths: { title: '照业壁', description: '石壁正面如镜，背面焦黑。明镜照业与魔心渡厄并非善恶二路，只是承受与偿还的先后不同。' },
    arena: { title: '问身场', description: '场中木人不会退让。佛相留下因，魔相兑现果，无相只在战意圆满的一念间显现。' },
    cultivation: { title: '止观室', description: '室内只容一席一灯。呼吸落在皮肉，念头落在灯芯，直到两者都不再需要命名。' },
    alchemy: { title: '药师寮', description: '血莲、骨玉与寻常灵草分柜存放，药师只问药性，不问净秽。' },
    refinery: { title: '火供院', description: '炉火映出忿怒相，锤声却始终缓慢；每一件法器都要在火中去掉多余的名字。' },
    spiritVein: { title: '骨玉窟', description: '白色矿髓沿黑岩生长，如同山腹中的巨大骨骼。' },
    herbGarden: { title: '血莲池', description: '暗红池水并无腥气，莲叶托着晨露，供药师每周采撷。' },
    gate: { title: '不二门', description: '门额只有一道未写完的圆。来者从哪一侧入门，都由同一道钟声迎接。' },
    cave: { title: '面壁窟', description: '石窟里没有装饰，只有前人留下的坐痕与指印。' },
  },
  terms: {
    pathChanges: '道途变化', meridianPractice: '照身参悟', meridianLoadout: '参悟方案',
    abilityChanges: '三相神通', returnToAffairs: '返回知客寮', sweepActivity: '照壁拂尘', sweepCanvasLabel: '照壁拂尘游戏画布',
  },
};
