import {
  getRealmStageLevel,
  getRealmStageNaturalAttributeValue,
  getRealmStageUnallocatedAttributeBudget,
} from '../../../config/realmProgression';
import type { RealmStage, RealmType } from '../../../types/constants';
import { generateStarterBeast } from '../beasts';
import { allocateBeast, gainBeastExp } from '../beasts/progression';
import { COMBAT_V6_SECT_DEFINITIONS, type CombatV6SectId } from '../content';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_TEMPLATES_V1,
  generateDaoEquipmentV1,
} from '../equipment';
import { OPEN_EQUIPMENT_LEVELS, equipmentRealm } from '../equipment/realm';
import { BODY_CULTIVATION_TRACK_KEYS } from '../../../lib/bodyCultivation/pack';
import type { BodyCultivationRealm, BodyCultivationState } from '../../../types/condition';

// Frozen progression samples; never inferred from the challenger at runtime.
const trainingByRealm: Partial<Record<RealmType, [BodyCultivationRealm, number]>> = {
  金丹: ['jade_marrow', 15],
  元婴: ['golden_body', 20],
  化神: ['dharma_body', 30],
  炼虚: ['dharma_body', 40],
  合体: ['dao_body', 45],
  大乘: ['dao_body', 50],
  渡劫: ['dao_body', 60],
};
// Legal attribute budgets and currently obtainable equipment. No rare bonuses.
export function towerReferenceBuild(
  sectId: CombatV6SectId,
  realm: RealmType = '金丹',
  stage: RealmStage = '中期',
  pathIndex?: 0 | 1,
): CombatV6TrainingPlayerInput {
  const def = COMBAT_V6_SECT_DEFINITIONS[sectId];
  const level = getRealmStageLevel(realm, stage);
  const [bodyRealm, trainingLevel] = trainingByRealm[realm] ?? ['mortal_body', 0];
  const natural = getRealmStageNaturalAttributeValue(realm, stage);
  const budget = getRealmStageUnallocatedAttributeBudget(realm, stage);
  const weights =
    sectId === 'lingxiao'
      ? [40, 150, 0, 30, 30, 0]
      : sectId === 'jiujie' || sectId === 'tianyan'
        ? [40, 0, 150, 0, 30, 30]
        : sectId === 'wuxiang'
          ? [60, 0, 70, 80, 20, 20]
          : [60, 0, 50, 0, 100, 40];
  const allocation = weights.map((weight) =>
    Math.floor((budget * weight) / 250),
  );
  allocation[0] += budget - allocation.reduce((a, b) => a + b, 0);
  const attrs = allocation.map((points) => natural + points);
  const equipmentLevel = [...OPEN_EQUIPMENT_LEVELS]
    .reverse()
    .find((n) => equipmentRealm(n).requiredLevel <= level)!;
  const owner = '00000000-0000-4000-8000-000000000001';
  const beast = gainBeastExp(
    generateStarterBeast(
      '00000000-0000-4000-8000-000000000002',
      owner,
      'combat.wild.species.rock-boar',
      42,
    ),
    100000000,
    level,
  );
  const pet = allocateBeast(
    beast,
    {
      constitution: level,
      strength: level * 3,
      magic: 0,
      endurance: Math.floor(level / 2),
      agility: level - Math.floor(level / 2),
    },
    level,
  );
  return {
    cultivator: {
      id: owner,
      name: sectId,
      realm,
      realm_stage: stage,
      condition: {
        version: 1,
        resources: { hp: { current: 1 }, mp: { current: 1 } },
        gauges: { pillToxicity: 0 },
        tracks: {
          bodyCultivation: {
            version: 1,
            realm: bodyRealm,
            tracks: Object.fromEntries(BODY_CULTIVATION_TRACK_KEYS.map(key =>
              [key, { level: trainingLevel, progress: 0 }],
            )) as BodyCultivationState['tracks'],
            milestones: {},
          },
        },
        counters: { longTermPillUsesByRealm: {}, cultivationPillUsesByRealm: {}, longevityPillUsesByRealm: {} },
        statuses: [],
        timestamps: {},
      },
      attributes: {
        vitality: attrs[0],
        strength: attrs[1],
        spirit: attrs[2],
        endurance: attrs[3],
        speed: attrs[4],
        willpower: attrs[5],
      },
    },
    sect: {
      version: 1,
      sectId,
      methods: Object.fromEntries(def.methods.map((m) => [m.id, level])),
      activePathId: def.paths[pathIndex ?? (sectId === 'jiujie' ? 1 : 0)].id,
      meridianDepth: 0,
      meridianLoadouts: [
        { pathId: def.paths[0].id, nodeIds: [], revision: 0 },
        { pathId: def.paths[1].id, nodeIds: [], revision: 0 },
      ],
    },
    equipment: Object.fromEntries(
      DAO_EQUIPMENT_TEMPLATES_V1.map((template, i) => {
        const result = generateDaoEquipmentV1({
          id: `reference-${i}`,
          templateId: template.id,
          equipmentLevel,
          baseQuality: 0,
          seed: 100 + i,
          createdAt: '2026-09-19T00:00:00Z',
          generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
        });
        if (!result.ok) throw new Error('参考道装生成失败');
        return [template.slot, result.instance];
      }),
    ),
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
    beasts: {
      beasts: [pet],
      lineup: { carriedBeastIds: [pet.id], leadBeastId: pet.id, revision: 0 },
    },
  };
}
