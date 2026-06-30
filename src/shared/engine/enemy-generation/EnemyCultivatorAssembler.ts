import {
  EnemyRace,
  GENDER_VALUES,
  REALM_ORDER,
} from '@shared/types/constants';
import { getRealmStageRank } from '@shared/config/realmProgression';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  BodyCultivationState,
  CultivatorCondition,
} from '@shared/types/condition';
import type {
  Artifact,
  Attributes,
  Cultivator,
  Skill,
  SpiritualRoot,
} from '@shared/types/cultivator';
import type {
  EnemyCraftedProduct,
  EnemyCraftedLoadout,
  EnemyRaceProfile,
  NormalizedEnemyGenerationInput,
} from './types';
import { hashText } from './utils';

function isArtifactProduct(
  entry: EnemyCraftedProduct,
): entry is EnemyCraftedProduct & { item: Artifact } {
  return 'slot' in entry.item;
}

function isSkillProduct(
  entry: EnemyCraftedProduct,
): entry is EnemyCraftedProduct & { item: Skill } {
  return 'cooldown' in entry.item;
}

function createEmptyConditionWithBodyCultivation(
  bodyCultivation: BodyCultivationState,
): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: { current: 0 },
      mp: { current: 0 },
    },
    gauges: {
      pillToxicity: 0,
    },
    tracks: {
      bodyCultivation,
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
      marrowWash: { level: 0, progress: 0 },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
      bodyCultivationPillUses: 0,
    },
    statuses: [],
    timestamps: {},
  };
}

function createEnemyCondition(
  cultivator: Cultivator,
  bodyCultivation: BodyCultivationState,
): CultivatorCondition {
  const condition = createEmptyConditionWithBodyCultivation(bodyCultivation);
  const display = getCultivatorDisplayAttributes({
    ...cultivator,
    condition,
  });

  return {
    ...condition,
    resources: {
      hp: { current: display.maxHp },
      mp: { current: display.maxMp },
    },
  };
}

export class EnemyCultivatorAssembler {
  assemble(args: {
    variantKey: string;
    input: NormalizedEnemyGenerationInput;
    profile: EnemyRaceProfile;
    primaryElement: EnemyCraftedLoadout['primaryElement'];
    attributes: Attributes;
    name: string;
    title: string;
    background: string;
    description: string;
    loadout: EnemyCraftedLoadout;
    bodyCultivation: BodyCultivationState;
  }): Cultivator {
    const {
      variantKey,
      input,
      primaryElement,
      attributes,
      name,
      title,
      background,
      description,
      loadout,
      bodyCultivation,
    } = args;
    const artifactEntries = loadout.artifacts.filter(isArtifactProduct);
    const skillEntries = loadout.skills.filter(isSkillProduct);

    const equipped = {
      weapon:
        artifactEntries.find((artifact) => artifact.item.slot === 'weapon')?.item.id ??
        null,
      armor:
        artifactEntries.find((artifact) => artifact.item.slot === 'armor')?.item.id ??
        null,
      accessory:
        artifactEntries.find(
          (artifact) => artifact.item.slot === 'accessory',
        )?.item.id ?? null,
    };

    const rootStrengthBonus = {
      灵族: 12,
      古兽: 10,
      鬼魂: 6,
    } as Record<EnemyRace, number>;

    const spiritualRoots: SpiritualRoot[] = [
      {
        element: primaryElement,
        strength: Math.min(
          100,
          Math.round(
            48 +
              input.difficulty * 0.45 +
              (REALM_ORDER[input.realm] ?? 0) * 2 +
              (rootStrengthBonus[input.race] ?? 0),
          ),
        ),
      },
    ];

    const gender = GENDER_VALUES[
      hashText(`${variantKey}:gender`) %
        GENDER_VALUES.length
    ];

    const cultivator: Cultivator = {
      id: `enemy:${variantKey}`,
      name,
      title,
      gender,
      race: input.race,
      realm: input.realm,
      realm_stage: input.realmStage,
      age: 30 + REALM_ORDER[input.realm] * 45 + (input.difficulty % 20),
      lifespan: 120 + getRealmStageRank(input.realm, input.realmStage) * 45,
      attributes,
      unallocated_attribute_points: 0,
      spiritual_roots: spiritualRoots,
      pre_heaven_fates: [],
      cultivations: [loadout.technique.item],
      skills: skillEntries.map((entry) => entry.item),
      inventory: {
        artifacts: artifactEntries.map((entry) => entry.item),
        consumables: [],
        materials: [],
      },
      equipped,
      spirit_stones: 0,
      background,
      description,
    };

    return {
      ...cultivator,
      condition: createEnemyCondition(cultivator, bodyCultivation),
    };
  }
}
