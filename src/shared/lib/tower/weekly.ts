import {
  allowedTowerFormations,
  TOWER_FORMATIONS,
  TOWER_GUARD_DETAIL,
  TOWER_HEALER_DETAIL,
  type TowerEnemyRole,
  type TowerFormationId,
  type TowerKeyFormation,
} from './formations';
import { hashTowerSeed, resolveTowerFloorKind } from './helpers';
import type { TowerSeasonMeta } from './types';

export const TOWER_CONTENT_VERSION = 'combat-v6-tower-v4' as const;
export const TOWER_KEY_FLOORS = [5, 10, 15, 20] as const;
export const TOWER_COMBINATIONS = [
  {
    id: 'warrior-ward-calm',
    style: 'physical',
    survival: 'ward',
    tempo: 'calm',
  },
  {
    id: 'warrior-armor-charge',
    style: 'physical',
    survival: 'armor',
    tempo: 'charge',
  },
  { id: 'mage-vital-swift', style: 'spell', survival: 'vital', tempo: 'swift' },
  { id: 'mage-armor-calm', style: 'spell', survival: 'armor', tempo: 'calm' },
  {
    id: 'binder-vital-swift',
    style: 'seal',
    survival: 'vital',
    tempo: 'swift',
  },
  { id: 'binder-ward-calm', style: 'seal', survival: 'ward', tempo: 'calm' },
] as const;
export type TowerCombination = (typeof TOWER_COMBINATIONS)[number];
export type TowerCombinationId = TowerCombination['id'];
export interface TowerWeek {
  version:
    typeof TOWER_CONTENT_VERSION | 'combat-v6-tower-v2' | 'combat-v6-tower-v3';
  seasonKey: string;
  floors: Array<{
    floor: number;
    combinationId: TowerCombinationId;
    formationId?: TowerKeyFormation;
    encounterId?: string;
  }>;
}

export const TOWER_GENERATOR_VERSION = 'tower-week-v1';
export const TOWER_ENCOUNTERS = TOWER_COMBINATIONS.flatMap((combo) =>
  allowedTowerFormations('boss', combo).map((formationId) => ({
    id: `${combo.id}:${formationId}`,
    combinationId: combo.id,
    formationId,
    kinds: allowedTowerFormations('elite', combo).includes(formationId)
      ? (['elite', 'boss'] as const)
      : (['boss'] as const),
  })),
);

/** Enumerate the small legal pool; soft preferences never relax combat constraints. */
export function createTowerWeek(
  season: TowerSeasonMeta,
  history: readonly TowerWeek[] = [],
  strategyScoring?: {
    history: readonly {
      seasonKey: string;
      floors: { floor: number; signature: string; formation: string }[];
    }[];
    identity: (row: TowerWeek['floors'][number]) => {
      signature: string;
      formation: string;
    };
  },
): TowerWeek {
  const index = Math.floor(Date.parse(season.seasonStartedAt) / (7 * 86400000));
  if (!Number.isFinite(index)) throw new Error('幻境周标识无效');
  const recent = history
    .filter((w) => w.seasonKey < season.seasonKey)
    .sort((a, b) => b.seasonKey.localeCompare(a.seasonKey))
    .slice(0, 3);
  const previous = recent[0];
  const slots = TOWER_KEY_FLOORS.map((floor, slot) => {
    const style = (['physical', 'spell', 'seal'] as const)[
      (((index + [0, 1, 1, 2][slot]) % 3) + 3) % 3
    ];
    return TOWER_ENCOUNTERS.filter(
      (e) =>
        e.kinds.some((k) => k === (floor % 10 === 0 ? 'boss' : 'elite')) &&
        towerCombination(e.combinationId).style === style,
    );
  });
  const strategyHistory = strategyScoring?.history
    .filter((w) => w.seasonKey < season.seasonKey)
    .sort((a, b) => b.seasonKey.localeCompare(a.seasonKey))
    .slice(0, 3);
  const identity = (r: TowerWeek['floors'][number]) =>
    `${r.combinationId}:${r.formationId ?? 'solo'}`;
  let best: TowerWeek['floors'] | undefined;
  let bestScore: number[] | undefined;
  function visit(rows: TowerWeek['floors']) {
    if (rows.length < 4) {
      for (const candidate of slots[rows.length]) {
        if (rows.some((r) => r.combinationId === candidate.combinationId))
          continue;
        visit([
          ...rows,
          {
            floor: TOWER_KEY_FLOORS[rows.length],
            combinationId: candidate.combinationId,
            formationId: candidate.formationId,
            encounterId: candidate.id,
          },
        ]);
      }
      return;
    }
    if (rows.every((r) => r.formationId === 'solo')) return;
    const repeats = (bossOnly: boolean) =>
      strategyScoring && strategyHistory
        ? rows.reduce(
            (n, r) =>
              n +
              (bossOnly && r.floor % 10 !== 0
                ? 0
                : strategyHistory.reduce(
                    (m, w) =>
                      m +
                      w.floors.filter(
                        (old) =>
                          old.signature ===
                          strategyScoring.identity(r).signature,
                      ).length,
                    0,
                  )),
            0,
          )
        : rows.reduce(
            (n, r) =>
              n +
              (bossOnly && r.floor % 10 !== 0
                ? 0
                : recent.reduce(
                    (m, w) =>
                      m +
                      w.floors.filter((old) => identity(old) === identity(r))
                        .length,
                    0,
                  )),
            0,
          );
    const signature = rows.map(identity).join('|');
    const score = [
      repeats(true),
      repeats(false),
      rows.filter((r) =>
        strategyScoring && strategyHistory
          ? strategyHistory[0]?.floors.find((p) => p.floor === r.floor)
              ?.formation === strategyScoring.identity(r).formation
          : previous?.floors.find((p) => p.floor === r.floor)?.formationId ===
            r.formationId,
      ).length,
      4 - new Set(rows.map((r) => r.formationId)).size,
      hashTowerSeed(
        `${season.seasonKey}:${TOWER_GENERATOR_VERSION}:${signature}`,
      ),
    ];
    const firstDifference = score.findIndex((n, i) => n !== bestScore?.[i]);
    if (
      !bestScore ||
      (firstDifference >= 0 &&
        score[firstDifference] < bestScore[firstDifference])
    ) {
      best = rows;
      bestScore = score;
    }
  }
  visit([]);
  if (!best) throw new Error('幻境周组合池无法满足编排规则');
  return {
    version: TOWER_CONTENT_VERSION,
    seasonKey: season.seasonKey,
    floors: best,
  };
}
export function towerCombination(id: TowerCombinationId): TowerCombination {
  const found = TOWER_COMBINATIONS.find((c) => c.id === id);
  if (!found) throw new Error('幻境组合版本无法恢复');
  return found;
}
export function towerFormation(
  floor: number,
  week: TowerWeek,
): TowerFormationId {
  const kind = resolveTowerFloorKind(floor);
  if (kind !== 'normal') {
    const row = week.floors.find((r) => r.floor === floor);
    if (!row) throw new Error('幻境关键层缺少阵容');
    if (week.version !== 'combat-v6-tower-v2' && !row.formationId)
      throw new Error('幻境关键层缺少阵容');
    const formation = row.formationId ?? 'solo';
    if (
      !allowedTowerFormations(
        kind,
        towerCombination(row.combinationId),
      ).includes(formation)
    )
      throw new Error('幻境阵容与套路不兼容');
    return formation;
  }
  const n = ((floor - 1) % 10) + 1;
  if ([4, 7].includes(n)) return 'healer';
  if (week.version !== 'combat-v6-tower-v2' && n === 8) return 'escort';
  if (week.version !== 'combat-v6-tower-v2' && n === 9) return 'guarded';
  return [2, 6, 8, 9].includes(n) ? 'pair' : 'solo';
}
export interface TowerEnemyMember {
  id: string;
  name: string;
  icon: string;
  role: TowerEnemyRole;
  details: string[];
}
export interface TowerEnemyPreview {
  floor: number;
  kind: 'normal' | 'elite' | 'boss';
  name: string;
  icon: string;
  labels: string[];
  details: string[];
  formationId?: TowerFormationId;
  members: TowerEnemyMember[];
}
function leaderPreview(
  floor: number,
  week: TowerWeek,
): Omit<TowerEnemyPreview, 'formationId' | 'members'> {
  const kind = resolveTowerFloorKind(floor);
  if (kind !== 'normal') {
    const row = week.floors.find((r) => r.floor === floor);
    if (
      !row ||
      ![
        'combat-v6-tower-v2',
        'combat-v6-tower-v3',
        TOWER_CONTENT_VERSION,
      ].includes(week.version)
    )
      throw new Error('幻境周表无法恢复');
    const c = towerCombination(row.combinationId);
    const styles = {
      physical: ['武斗', '负碑蜃卫', '⚔️'],
      spell: ['术法', '照影镜主', '🔮'],
      seal: ['封印', '缚梦幻师', '🪬'],
    };
    const survival = {
      vital: ['厚血', '气血较高，双防较薄。'],
      armor: ['铁甲', '偏重物防，法防较低。'],
      ward: ['灵障', '偏重法防，物防较低。'],
    };
    const tempo = {
      swift: ['疾行', '速度较快，但并非必定先手。'],
      calm: ['定神', '封印抵抗提高 10 点，并非免疫。'],
      charge: [
        '蓄势',
        '每三回合：蓄势 → 物理重击 → 普通攻击。重击可被控制跳过；成功施放重击后至下一回合结束承伤提高 25%。',
      ],
    };
    const behavior =
      c.style === 'seal'
        ? '第 1、4、7…回合尝试封住单个目标的法术与物理技能，持续当回合及下一回合；其余回合弱法术。防御、保护仍可使用，每个周期至少留出一回合进攻空档。'
        : c.style === 'spell'
          ? '每第三回合群体法术，其余回合单体法术；群法后至下一回合结束承伤提高 25%。'
          : '每第三回合双段物理攻击，其余回合单体物理攻击；防御与保护可减少物理压力。';
    return {
      floor,
      kind,
      name: styles[c.style][1],
      icon: styles[c.style][2],
      labels: [styles[c.style][0], survival[c.survival][0], tempo[c.tempo][0]],
      details: [
        c.tempo === 'charge' ? tempo.charge[1] : behavior,
        survival[c.survival][1],
        ...(c.tempo === 'charge' ? [] : [tempo[c.tempo][1]]),
        ...(kind === 'boss'
          ? [
              '回合开始时气血首次低于 40%，伤害提高 15%，持续至战斗结束；不额外行动。',
            ]
          : []),
      ],
    };
  }
  const n = ((floor - 1) % 10) + 1;
  const mage = n === 3 || n === 7;
  const healer = n === 4 || n === 7;
  const pair = [2, 4, 6, 7, 8, 9].includes(n);
  return {
    floor,
    kind,
    name: mage ? '碎镜术士' : n >= 8 ? '护镜傀' : '蜃影剑卫',
    icon: mage ? '🔮' : '⚔️',
    labels: healer
      ? mage
        ? ['群法', '幻侍疗伤']
        : ['幻侍疗伤']
      : pair
        ? ['双卫夹击']
        : mage
          ? ['群法 · 施法后破绽']
          : ['单体攻击'],
    details: [
      mage
        ? '每第三回合群体法术；施法后至下一回合结束承伤提高 25%。'
        : '普通攻击为主，每第三回合较强单体攻击。',
      ...(healer
        ? ['执灯幻侍每第三回合治疗受伤同伴，其余回合弱攻击。可先击破幻侍。']
        : pair
          ? ['两名敌人同时迎战，集火可减少敌方行动。']
          : []),
    ],
  };
}

export function towerEnemyPreview(
  floor: number,
  week: TowerWeek,
): TowerEnemyPreview {
  const leader = leaderPreview(floor, week);
  const formationId = towerFormation(floor, week);
  const formation = TOWER_FORMATIONS[formationId];
  const groupDetail =
    formationId === 'healer'
      ? TOWER_HEALER_DETAIL
      : formationId === 'escort' || formationId === 'guarded'
        ? TOWER_GUARD_DETAIL
        : undefined;
  const leaderDetails =
    leader.kind === 'normal' ? leader.details.slice(0, 1) : leader.details;
  const members = formation.roles.map((role, slot) => ({
    id: `tower.enemy.${slot}`,
    role,
    name:
      role === 'healer'
        ? '执灯幻侍'
        : role === 'guard'
          ? `镜侍${slot === 1 ? '·左' : '·右'}`
          : leader.name,
    icon: role === 'healer' ? '🏮' : role === 'guard' ? '🪞' : leader.icon,
    details:
      role === 'healer'
        ? [TOWER_HEALER_DETAIL]
        : role === 'guard'
          ? [TOWER_GUARD_DETAIL]
          : leaderDetails,
  }));
  return {
    ...leader,
    formationId,
    members,
    labels:
      formationId === 'solo'
        ? leader.labels
        : [formation.label, ...(leader.kind === 'normal' ? [] : leader.labels)],
    details: groupDetail ? [groupDetail, ...leaderDetails] : leader.details,
  };
}
