import type {
  AchievementCategory,
  AchievementDefinition,
  AchievementSeriesDefinition,
} from '@daoyou/game-domain/achievements';

export const ACHIEVEMENT_CATEGORIES: readonly {
  id: AchievementCategory;
  label: string;
}[] = [
  { id: 'cultivation', label: '修行' },
  { id: 'sect', label: '宗门' },
  { id: 'companions', label: '灵兽' },
  { id: 'craft', label: '丹器' },
  { id: 'garden', label: '灵田' },
  { id: 'exploration', label: '历练' },
  { id: 'mentorship', label: '师承' },
];

const snapshotHint = '依据本角色已记录的修行事实判定，已获得成就永久保留。';
const counterHint = '按本角色已记录的玩法次数累计，无法确认的历史不补计。';

export const ACHIEVEMENT_SERIES: readonly AchievementSeriesDefinition[] = [
  {
    id: 'cultivation.realm',
    name: '破境问道',
    category: 'cultivation',
    unit: '',
    tracking: 'snapshot',
    trackingHint: snapshotHint,
    action: { label: '前往修行', href: '/game/retreat' },
  },
  {
    id: 'manuals.level',
    name: '功法精进',
    category: 'cultivation',
    unit: '层',
    tracking: 'snapshot',
    trackingHint: snapshotHint,
    action: { label: '修炼功法', href: '/game/cultivator?tab=manuals' },
  },
  {
    id: 'body.level',
    name: '百炼之躯',
    category: 'cultivation',
    unit: '级',
    tracking: 'snapshot',
    trackingHint: snapshotHint,
    action: { label: '锤炼体魄', href: '/game/body-cultivation' },
  },
  {
    id: 'sect_methods.level',
    name: '宗门根基',
    category: 'sect',
    unit: '级',
    tracking: 'snapshot',
    trackingHint: snapshotHint,
    action: { label: '研修心法', href: '/game/sect/archive/methods' },
  },
  {
    id: 'beasts.level',
    name: '灵兽相伴',
    category: 'companions',
    unit: '级',
    tracking: 'snapshot',
    trackingHint: snapshotHint,
    action: { label: '培育灵兽', href: '/game/beasts' },
  },
  {
    id: 'beasts.fusions',
    name: '融灵新生',
    category: 'companions',
    unit: '次',
    tracking: 'snapshot',
    trackingHint: '依据本角色的融合记录累计，已获得成就永久保留。',
    action: { label: '灵兽融合', href: '/game/beasts/fusion' },
  },
  {
    id: 'alchemy.crafts',
    name: '丹火不息',
    category: 'craft',
    unit: '次',
    tracking: 'counter',
    trackingHint: counterHint,
    action: { label: '前往炼丹', href: '/game/craft/alchemy' },
  },
  {
    id: 'forging.equipment',
    name: '锻器成章',
    category: 'craft',
    unit: '件',
    tracking: 'counter',
    trackingHint: counterHint,
    action: { label: '前往炼器', href: '/game/craft/refine' },
  },
  {
    id: 'spirit_field.harvests',
    name: '耕云种月',
    category: 'garden',
    unit: '批',
    tracking: 'snapshot',
    trackingHint: '每次灵田收获记一批，按本角色的收获记录累计。',
    action: { label: '照看灵田', href: '/game/spirit-field' },
  },
  {
    id: 'exploration.claims',
    name: '行路有得',
    category: 'exploration',
    unit: '次',
    tracking: 'counter',
    trackingHint: counterHint,
    action: { label: '领取历练收获', href: '/game' },
  },
  {
    id: 'dungeon.completions',
    name: '洞天寻踪',
    category: 'exploration',
    unit: '次',
    tracking: 'counter',
    trackingHint: counterHint,
    action: { label: '前往云游', href: '/game/dungeon' },
  },
  {
    id: 'mentorship.apprentice',
    name: '一脉师承',
    category: 'mentorship',
    unit: '',
    tracking: 'snapshot',
    trackingHint: '师承属于拜师时的角色，已获得成就永久保留。',
    action: { label: '查看师门', href: '/game/mentorship' },
  },
  {
    id: 'mentorship.graduates',
    name: '桃李成蹊',
    category: 'mentorship',
    unit: '人',
    tracking: 'snapshot',
    trackingHint: '只统计本角色培养的出师弟子，已获得成就永久保留。',
    action: { label: '翻阅桃李簿', href: '/game/mentorship?tab=records' },
  },
];

function tiers({
  seriesId,
  idPrefix,
  metric,
  entries,
  description,
  condition,
}: {
  seriesId: string;
  idPrefix: string;
  metric: string;
  entries: readonly (readonly [number, string])[];
  description: string;
  condition: (target: number) => string;
}): AchievementDefinition[] {
  return entries.map(([target, name], index) => ({
    id: idPrefix + '.' + target,
    seriesId,
    tier: index + 1,
    name,
    description,
    condition: condition(target),
    requirement: { metric, target },
  }));
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: 'mentorship.apprentice',
    seriesId: 'mentorship.apprentice',
    tier: 1,
    name: '师承有道',
    description: '铭记引你入道的师承。',
    condition: '与一位师父正式结为师徒',
    requirement: { metric: 'mentorship.bound', target: 1 },
    nameTemplate: '{mentorName}之徒',
  },
  ...tiers({
    seriesId: 'mentorship.graduates',
    idPrefix: 'mentorship.graduates',
    metric: 'mentorship.graduated_disciples',
    entries: [
      [2, '为人师表'],
      [6, '循循善诱'],
      [12, '诲人不倦'],
      [20, '厚德树人'],
      [30, '桃李天下'],
    ],
    description: '传下修行心得，见证后辈独自成道。',
    condition: (target) => '累计培养' + target + '位弟子成功出师',
  }),
  ...[
    [1, '筑基', '筑就道基', '灵气凝基，仙途自此渐宽。'],
    [2, '金丹', '金丹初成', '丹光内蕴，百炼终有所成。'],
    [3, '元婴', '婴成道显', '道胎初成，眼前又见新天地。'],
    [4, '化神', '化神入妙', '神与道合，修行更进一境。'],
    [5, '炼虚', '炼虚问道', '炼虚求真，遥问天地之理。'],
    [6, '合体', '合体归真', '形神相合，一身道意渐明。'],
    [7, '大乘', '大乘无量', '道行渐至圆融，回望来路万千。'],
    [8, '渡劫', '渡劫问仙', '行至劫前，仍向仙途迈步。'],
  ].map(([rank, realm, name, description]): AchievementDefinition => ({
    id: 'cultivation.realm.' + rank,
    seriesId: 'cultivation.realm',
    tier: Number(rank),
    name: String(name),
    description: String(description),
    condition: '境界达到' + realm + '期',
    requirement: { metric: 'cultivation.realm_rank', target: Number(rank) },
  })),
  ...tiers({
    seriesId: 'manuals.level',
    idPrefix: 'manuals.level',
    metric: 'manuals.max_level',
    entries: [
      [1, '初窥门径'],
      [6, '登堂入室'],
      [9, '功行圆满'],
    ],
    description: '把纸上法门炼成自身所长。',
    condition: (target) => '任意一门已学功法达到' + target + '层',
  }),
  ...tiers({
    seriesId: 'sect_methods.level',
    idPrefix: 'sect_methods.level',
    metric: 'sect_methods.max_level',
    entries: [
      [20, '宗门新秀'],
      [60, '心法精深'],
      [100, '宗门砥柱'],
    ],
    description: '承一门道统，沉心研修不辍。',
    condition: (target) => '任意一门当前宗门心法达到' + target + '级',
  }),
  ...tiers({
    seriesId: 'body.level',
    idPrefix: 'body.level',
    metric: 'body.max_track_level',
    entries: [
      [10, '筋骨初炼'],
      [20, '百炼成身'],
      [30, '体魄如岳'],
    ],
    description: '以日积月累，换一身坚实体魄。',
    condition: (target) => '任意一条炼体轨达到' + target + '级',
  }),
  ...tiers({
    seriesId: 'beasts.level',
    idPrefix: 'beasts.level',
    metric: 'beasts.max_level',
    entries: [
      [10, '灵伴初长'],
      [30, '并肩同行'],
      [60, '御灵有道'],
    ],
    description: '与灵兽相伴成长，共赴前路。',
    condition: (target) => '任意一只持有灵兽达到' + target + '级',
  }),
  ...tiers({
    seriesId: 'beasts.fusions',
    idPrefix: 'beasts.fusions',
    metric: 'beasts.fusions',
    entries: [
      [1, '灵契新生'],
      [10, '融灵妙手'],
      [30, '万灵归一'],
    ],
    description: '合两份灵机，续一段新的灵契。',
    condition: (target) => '累计完成' + target + '次灵兽融合',
  }),
  ...tiers({
    seriesId: 'alchemy.crafts',
    idPrefix: 'alchemy.crafts',
    metric: 'alchemy.crafts',
    entries: [
      [1, '初试丹火'],
      [10, '炉火渐纯'],
      [50, '丹道有成'],
    ],
    description: '守一炉丹火，慢慢摸清药性与火候。',
    condition: (target) => '累计完成' + target + '次炼丹',
  }),
  ...tiers({
    seriesId: 'forging.equipment',
    idPrefix: 'forging.equipment',
    metric: 'forging.equipment',
    entries: [
      [1, '初铸锋芒'],
      [10, '锤下生光'],
      [50, '百炼成器'],
    ],
    description: '灵材经火与锤炼，渐成趁手之器。',
    condition: (target) => '累计锻造' + target + '件道装',
  }),
  ...tiers({
    seriesId: 'spirit_field.harvests',
    idPrefix: 'spirit_field.harvests',
    metric: 'spirit_field.harvests',
    entries: [
      [1, '灵田初获'],
      [10, '草木知时'],
      [50, '耕云种月'],
    ],
    description: '照看一方灵田，静候草木回报。',
    condition: (target) => '累计完成' + target + '批灵田收获',
  }),
  ...tiers({
    seriesId: 'exploration.claims',
    idPrefix: 'exploration.claims',
    metric: 'exploration.claims',
    entries: [
      [1, '初涉山川'],
      [20, '行路有得'],
      [100, '万里行者'],
    ],
    description: '一次次出门历练，把所得带回洞府。',
    condition: (target) => '累计领取' + target + '次历练收获',
  }),
  ...tiers({
    seriesId: 'dungeon.completions',
    idPrefix: 'dungeon.completions',
    metric: 'dungeon.completions',
    entries: [
      [1, '洞天初探'],
      [10, '秘境行家'],
      [50, '踏破秘境'],
    ],
    description: '从一段险境中全身而退，带回自己的见闻。',
    condition: (target) => '累计完整通关' + target + '次云游秘境',
  }),
];

export function findAchievementDefinition(
  id: string,
): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === id);
}

export function findAchievementSeries(
  id: string,
): AchievementSeriesDefinition | undefined {
  return ACHIEVEMENT_SERIES.find((series) => series.id === id);
}
