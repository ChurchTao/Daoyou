import type { SectFacilityKey, SectPermission } from '@shared/engine/sect';

export type SectMapHotspot = {
  id: string;
  label: string;
  route?: string;
  facility?: SectFacilityKey;
  permission?: SectPermission;
  left: string;
  top: string;
  note: string;
  locked?: boolean;
};

export const SECT_MAP_HOTSPOTS: readonly SectMapHotspot[] = [
  { id: 'hall', label: '宗门大殿', route: '/game/sect/hall', permission: 'scene.hall', left: '46%', top: '25%', note: '身份 · 晋升 · 周俸' },
  { id: 'archive', label: '藏经阁', route: '/game/sect/archive', facility: 'archive', permission: 'scene.archive', left: '15%', top: '31%', note: '心法研习' },
  { id: 'cliff', label: '悟道崖', route: '/game/sect/enlightenment-cliff', permission: 'scene.enlightenment_cliff', left: '88%', top: '19%', note: '流派 · 经脉' },
  { id: 'arena', label: '演武台', route: '/game/sect/arena', permission: 'scene.arena', left: '57%', top: '64%', note: '神通 · 战术' },
  { id: 'affairs', label: '执事堂', route: '/game/sect/affairs', permission: 'scene.affairs', left: '42%', top: '48%', note: '日常 · 周常 · 悬赏' },
  { id: 'treasury', label: '宗门宝库', route: '/game/sect/treasury', permission: 'scene.treasury', left: '57%', top: '36%', note: '贡献兑换' },
  { id: 'industries', label: '百业院', route: '/game/sect/industries', permission: 'scene.industries', left: '55%', top: '53%', note: '宗门共建' },
  { id: 'cultivation', label: '修炼室', route: '/game/sect/cultivation-room', facility: 'cultivation_room', permission: 'scene.cultivation_room', left: '17%', top: '72%', note: '聚灵闭关' },
  { id: 'alchemy', label: '丹房', route: '/game/sect/alchemy', facility: 'workshop', permission: 'scene.alchemy', left: '64%', top: '43%', note: '丹火炼药' },
  { id: 'refinery', label: '器坊', route: '/game/sect/refinery', facility: 'workshop', permission: 'scene.refinery', left: '69%', top: '51%', note: '地火铸器' },
  { id: 'vein', label: '灵脉矿场', route: '/game/sect/spirit-vein', facility: 'spirit_vein', permission: 'scene.spirit_vein', left: '84%', top: '46%', note: '灵石俸禄加成' },
  { id: 'garden', label: '药田', route: '/game/sect/herb-garden', facility: 'herb_garden', permission: 'scene.herb_garden', left: '83%', top: '75%', note: '每周灵草产出' },
  { id: 'gate', label: '山门', route: '/game/sect/gate', permission: 'scene.gate', left: '48%', top: '77%', note: '宗门动态' },
  { id: 'cave', label: '私人洞府', route: '/game/sect/cave', permission: 'scene.cave', left: '26%', top: '66%', note: '内门弟子居所' },
  { id: 'formation', label: '护山大阵', facility: 'formation', permission: 'scene.formation', left: '49%', top: '8%', note: '宗门战后续开放', locked: true },
] as const;
