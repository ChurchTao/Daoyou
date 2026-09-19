// Schema 1 conversion and regression fixtures only. Not a runtime publication format.
import { TOWER_ELIGIBLE_REALMS } from '../../../lib/tower/helpers';
import type { TowerSeasonMeta } from '../../../lib/tower/types';
import {
  createTowerWeek,
  TOWER_GENERATOR_VERSION,
  towerEnemyPreview,
  type TowerEnemyPreview,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import { compileTowerEncounter } from './content';

type Encounter = ReturnType<typeof compileTowerEncounter>;
export interface LegacyPublishedTowerWeek {
  schemaVersion: 1;
  generatorVersion: string;
  season: TowerSeasonMeta;
  week: TowerWeek;
  history: TowerWeek[];
  previews: TowerEnemyPreview[];
  skills: Encounter['skills'];
  statusDefs: Encounter['statusDefs'];
  encounters: Record<string, Array<Pick<Encounter, 'units' | 'plans'>>>;
}
export function publishLegacyTowerWeek(
  season: TowerSeasonMeta,
  history: TowerWeek[] = [],
): LegacyPublishedTowerWeek {
  const week = createTowerWeek(season, history);
  const sample = compileTowerEncounter('金丹', 1, week);
  const published: LegacyPublishedTowerWeek = structuredClone({
    schemaVersion: 1,
    generatorVersion: TOWER_GENERATOR_VERSION,
    season,
    week,
    history,
    previews: Array.from({ length: 20 }, (_, i) =>
      towerEnemyPreview(i + 1, week),
    ),
    skills: sample.skills,
    statusDefs: sample.statusDefs,
    encounters: Object.fromEntries(
      TOWER_ELIGIBLE_REALMS.map((realm) => [
        realm,
        Array.from({ length: 20 }, (_, i) => {
          const { units, plans } = compileTowerEncounter(realm, i + 1, week);
          return { units, plans };
        }),
      ]),
    ),
  });
  validateLegacyPublishedTowerWeek(published);
  return published;
}
/** Validate publication facts without consulting the mutable authoring registry. */
export function validateLegacyPublishedTowerWeek(
  pack: LegacyPublishedTowerWeek,
) {
  if (
    pack.schemaVersion !== 1 ||
    pack.previews.length !== 20 ||
    pack.week.seasonKey !== pack.season.seasonKey
  )
    throw new Error('幻境发布配置不完整');
  const skills = new Set(pack.skills.map((s) => s.id));
  if (skills.size !== pack.skills.length) throw new Error('幻境技能ID重复');
  for (const floors of Object.values(pack.encounters)) {
    if (floors.length !== 20) throw new Error('幻境发布配置缺层');
    floors.forEach(({ units, plans }, index) => {
      const members = pack.previews[index].members;
      if (
        units.length !== members.length ||
        new Set(units.map((u) => u.id)).size !== units.length
      )
        throw new Error('幻境阵容与预览不一致');
      units.forEach((unit, slot) => {
        if (
          !unit.id ||
          unit.id !== members[slot].id ||
          unit.name !== members[slot].name ||
          !Number.isFinite(unit.attrs.maxHp) ||
          (unit.attrs.maxHp ?? 0) <= 0
        )
          throw new Error('幻境敌人配置无效');
        const cycle = plans[unit.id]?.cycle;
        if (
          !cycle?.length ||
          [
            ...(unit.skills ?? []),
            ...(unit.passives ?? []),
            ...cycle.filter((id) => id !== 'attack'),
          ].some((id) => !skills.has(id))
        )
          throw new Error('幻境行动引用无效');
      });
    });
  }
}
