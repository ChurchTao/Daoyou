import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import { SeededBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import { AbilityType, AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import { prepareStandardFullBattle } from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import { getSectMethodLevelCap } from '@shared/engine/sect/core';
import { PRODUCTION_SECTS } from '@shared/engine/sect/content';
import {
  JIUJIE_CONDEMNATION_PATH_ID,
  JIUJIE_EYE_PATH_ID,
} from '@shared/engine/sect/content/jiujie';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { REALM_VALUES, type RealmType } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';

type Profile = 'offense' | 'balanced' | 'defense';
type Behavior = 'active' | 'mixed' | 'basic';
type Path = 'eye' | 'condemnation';

const seeds = ['a', 'b', 'c', 'd'];
const profiles: Profile[] = ['offense', 'balanced', 'defense'];
const behaviors: Behavior[] = ['active', 'mixed', 'basic'];
const pathIds = {
  eye: JIUJIE_EYE_PATH_ID,
  condemnation: JIUJIE_CONDEMNATION_PATH_ID,
} as const;
const layerByRealm: Record<RealmType, string[]> = {
  炼气: [],
  筑基: ['1'],
  金丹: ['1', '2'],
  元婴: ['1', '2'],
  化神: ['1', '2', '3'],
  炼虚: ['1', '2', '3', '4'],
  合体: ['1', '2', '3', '4'],
  大乘: ['1', '2', '3', '4', '5'],
  渡劫: ['1', '2', '3', '4', '5', 'ultimate'],
};

const builds = {
  eye: {
    offense: ['eye-bear', 'eye-question', 'eye-deep-return', 'eye-heavy-thunder', 'eye-true-record', 'eye-nine-gates'],
    sustain: ['eye-first-light', 'eye-record', 'eye-guard', 'eye-shelter', 'eye-returning-law', 'eye-heavenly-shield'],
    cycle: ['eye-open', 'eye-return', 'eye-still', 'eye-long-gaze', 'eye-after-rain', 'eye-calamity-without-end'],
  },
  condemnation: {
    offense: ['condemnation-question', 'condemnation-repeat', 'condemnation-no-pardon', 'condemnation-heavy-statute', 'condemnation-reoffend', 'condemnation-final-verdict'],
    control: ['condemnation-first-crime', 'condemnation-long-record', 'condemnation-debt-book', 'condemnation-three-questions', 'condemnation-clear-book', 'condemnation-nine-crimes'],
    cycle: ['condemnation-record', 'condemnation-heavy-debt', 'condemnation-heaven-hearing', 'condemnation-quick-record', 'condemnation-no-escape', 'condemnation-heavenly-punishment'],
  },
} as const;

const weights: Record<Profile, Record<keyof Cultivator['attributes'], number>> = {
  offense: { vitality: 0.13, strength: 0.08, spirit: 0.31, endurance: 0.13, speed: 0.22, willpower: 0.13 },
  balanced: { vitality: 1 / 6, strength: 1 / 6, spirit: 1 / 6, endurance: 1 / 6, speed: 1 / 6, willpower: 1 / 6 },
  defense: { vitality: 0.25, strength: 0.07, spirit: 0.16, endurance: 0.25, speed: 0.11, willpower: 0.16 },
};

function attributes(realm: RealmType, profile: Profile): Cultivator['attributes'] {
  const budget = getRealmStageAttributeBudget(realm, '圆满');
  const weight = weights[profile];
  const result: Cultivator['attributes'] = {
    vitality: Math.max(1, Math.floor(budget * weight.vitality)),
    strength: Math.max(1, Math.floor(budget * weight.strength)),
    spirit: Math.max(1, Math.floor(budget * weight.spirit)),
    endurance: Math.max(1, Math.floor(budget * weight.endurance)),
    speed: Math.max(1, Math.floor(budget * weight.speed)),
    willpower: Math.max(1, Math.floor(budget * weight.willpower)),
  };
  const used = Object.values(result).reduce((sum, value) => sum + value, 0);
  result.spirit += budget - used;
  return result;
}

function baseCultivator(id: string, realm: RealmType, profile: Profile): Cultivator {
  return {
    id,
    name: id,
    title: null,
    gender: '男',
    realm,
    realm_stage: '圆满',
    age: 100,
    lifespan: 10_000,
    attributes: attributes(realm, profile),
    spiritual_roots: [{ element: '雷', strength: 80 }],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    spirit_stones: 0,
    background: '九劫平衡模拟',
  };
}

function methodLevels(realm: RealmType, methodIds: string[]) {
  const level = getSectMethodLevelCap(realm, '圆满');
  return Object.fromEntries(methodIds.map((id) => [id, level]));
}

function jiujieCultivator(realm: RealmType, profile: Profile, path: Path, build: string): Cultivator {
  const cultivator = baseCultivator(`jiujie:${realm}:${profile}:${path}:${build}`, realm, profile);
  const availableLayers = layerByRealm[realm];
  const allNodes = builds[path][build as keyof typeof builds[Path]] as readonly string[];
  const selectedNodes = allNodes.slice(0, availableLayers.length);
  cultivator.sect = {
    membershipId: cultivator.id!,
    sectId: 'jiujie',
    status: 'active',
    contribution: 0,
    configVersion: 1,
    activePathId: pathIds[path],
    methods: methodLevels(realm, ['jiujie-canon', 'calamity-eye', 'heavenly-record', 'thunder-prison', 'cause-judgment', 'crossing-calamity']),
    paths: [{
      pathId: pathIds[path],
      unlockedLayerIds: availableLayers,
      tacticId: path === 'eye' ? 'bear-and-return' : 'record-and-judge',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: selectedNodes, version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['heaven-hearing', 'calamity-seal', 'thunder-prison-question', 'nine-sky-settlement'],
  };
  return cultivator;
}

function behaviorAbility(behavior: Behavior, basic: boolean) {
  const coefficient = basic ? 0.8 : 0.95;
  return {
    id: `behavior:${behavior}:${basic ? 'basic' : 'active'}`,
    name: basic ? '标准普攻' : '标准主动术',
    element: '雷' as const,
    description: '平衡模拟行为技能',
    quality: '凡品' as const,
    cost: 0,
    cooldown: basic ? 0 : behavior === 'mixed' ? 2 : 0,
    target_self: false,
    abilityConfig: {
      slug: `simulation.${behavior}.${basic ? 'basic' : 'active'}`,
      name: basic ? '标准普攻' : '标准主动术',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        basic ? GameplayTags.ABILITY.KIND.BASIC : GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      cooldown: basic ? 0 : behavior === 'mixed' ? 2 : 0,
      targetPolicy: { team: 'enemy' as const, scope: 'single' as const },
      effects: [{
        type: 'damage' as const,
        params: {
          value: { attribute: AttributeType.MAGIC_ATK, coefficient },
          damageType: DamageType.MAGICAL,
        },
      }],
    },
  };
}

function behaviorOpponent(realm: RealmType, behavior: Behavior): Cultivator {
  const cultivator = baseCultivator(`opponent:${realm}:${behavior}`, realm, 'balanced');
  cultivator.skills = behavior === 'active'
    ? [behaviorAbility(behavior, false)]
    : behavior === 'basic'
      ? [behaviorAbility(behavior, true)]
      : [behaviorAbility(behavior, false), behaviorAbility(behavior, true)];
  return cultivator;
}

function productionOpponent(realm: RealmType, sectId: string): Cultivator {
  const entry = PRODUCTION_SECTS.find((candidate) => candidate.module.definition.id === sectId)!;
  const definition = entry.module.definition;
  const cultivator = baseCultivator(`production:${realm}:${sectId}`, realm, 'balanced');
  const path = definition.paths[0];
  const layers = path ? layerByRealm[realm] : [];
  const nodeIds = path
    ? layers.map((layer) => path.nodes.find((node) => node.layerId === layer)?.id).filter((id): id is string => Boolean(id))
    : [];
  const initial = definition.onboarding.initialAbilityLoadout.filter((id): id is string => Boolean(id));
  const candidates = definition.abilities
    .filter((ability) => ability.kind === 'active')
    .sort((left, right) => Number(right.role === 'finisher') - Number(left.role === 'finisher'))
    .map((ability) => ability.id);
  const loadout = [...new Set([...initial, ...candidates])].slice(0, 4);
  cultivator.sect = {
    membershipId: cultivator.id!,
    sectId,
    status: 'active',
    contribution: 0,
    configVersion: definition.configVersion,
    activePathId: path?.id,
    methods: methodLevels(realm, definition.methods.map((method) => method.id)),
    paths: path ? [{
      pathId: path.id,
      unlockedLayerIds: layers,
      tacticId: path.defaultTacticId,
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds, version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }] : [],
    abilityLoadout: [loadout[0] ?? null, loadout[1] ?? null, loadout[2] ?? null, loadout[3] ?? null],
  };
  return cultivator;
}

type Sample = {
  realm: RealmType;
  path: Path;
  build: string;
  profile: Profile;
  behavior: string;
  turns: number;
  won: boolean;
  settled: boolean;
  firstSettlement?: number;
};

const samples: Sample[] = [];
const errors: string[] = [];

function runOne(player: Cultivator, opponent: Cultivator, meta: Omit<Sample, 'turns' | 'won' | 'settled' | 'firstSettlement'>, seed: string) {
  try {
    const record = simulateBattleV5(
      prepareStandardFullBattle({ player, opponent }),
      new SeededBattleRandomSource(`${meta.realm}:${meta.path}:${meta.build}:${meta.profile}:${meta.behavior}:${seed}`),
    );
    const settlements = record.sequences.filter((sequence) =>
      sequence.actor?.id === player.id && sequence.ability?.id === 'sect.jiujie.nine-sky-settlement');
    samples.push({
      ...meta,
      turns: record.outcome.turns,
      won: record.outcome.winner.id === player.id,
      settled: settlements.length > 0,
      ...(settlements[0] ? { firstSettlement: settlements[0].turn } : {}),
    });
  } catch (error) {
    errors.push(`${meta.realm}/${meta.path}/${meta.build}/${meta.profile}/${meta.behavior}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const realm of REALM_VALUES) {
  for (const path of ['eye', 'condemnation'] as const) {
    for (const build of Object.keys(builds[path])) {
      for (const profile of profiles) {
        for (const behavior of behaviors) {
          for (const seed of seeds) {
            runOne(
              jiujieCultivator(realm, profile, path, build),
              behaviorOpponent(realm, behavior),
              { realm, path, build, profile, behavior },
              seed,
            );
          }
        }
      }
    }
  }
}

for (const realm of REALM_VALUES) {
  for (const path of ['eye', 'condemnation'] as const) {
    for (const opponentSect of PRODUCTION_SECTS.map((entry) => entry.module.definition.id).filter((id) => id !== 'jiujie')) {
      for (const seed of seeds) {
        runOne(
          jiujieCultivator(realm, 'balanced', path, 'offense'),
          productionOpponent(realm, opponentSect),
          { realm, path, build: 'offense', profile: 'balanced', behavior: `sect:${opponentSect}` },
          seed,
        );
      }
    }
  }
}

function aggregate(keys: Array<keyof Sample>, source = samples) {
  const groups = new Map<string, Sample[]>();
  for (const sample of source) {
    const key = keys.map((field) => String(sample[field])).join('|');
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const settled = group.filter((sample) => sample.settled);
    return {
      key,
      n: group.length,
      averageTurns: Number((group.reduce((sum, sample) => sum + sample.turns, 0) / group.length).toFixed(2)),
      winRate: Number((group.filter((sample) => sample.won).length / group.length).toFixed(3)),
      settlementRate: Number((settled.length / group.length).toFixed(3)),
      firstSettlement: settled.length
        ? Number((settled.reduce((sum, sample) => sum + (sample.firstSettlement ?? 0), 0) / settled.length).toFixed(2))
        : null,
    };
  });
}

const standard = samples.filter((sample) => !sample.behavior.startsWith('sect:'));
const production = samples.filter((sample) => sample.behavior.startsWith('sect:'));
process.stdout.write(JSON.stringify({
  metadata: {
    seeds: seeds.length,
    standardSamples: standard.length,
    productionSamples: production.length,
    errors: errors.length,
    errorExamples: errors.slice(0, 10),
  },
  realmPathBehavior: aggregate(['realm', 'path', 'behavior'], standard),
  realmPath: aggregate(['realm', 'path'], standard),
  detailed: aggregate(['realm', 'path', 'build', 'profile', 'behavior'], standard),
  buildProfile: aggregate(['path', 'build', 'profile'], standard),
  productionRoundRobin: aggregate(['realm', 'path', 'behavior'], production),
}, null, 2));
