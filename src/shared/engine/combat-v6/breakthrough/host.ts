import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import type { CreateBattleInput } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCharacterToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export const BREAKTHROUGH_CHALLENGES = {
  heart_demon_nascent: { title: '心魔劫', name: '心魔化身', hp: 1, attack: 1 },
  tribulation_deity: {
    title: '化神之扰',
    name: '天劫投影',
    hp: 2,
    attack: 1.1,
  },
  law_insight_void: {
    title: '法则试锋',
    name: '法则残影',
    hp: 2.2,
    attack: 1.15,
  },
  tribulation_body: {
    title: '雷劫淬体',
    name: '劫雷化身',
    hp: 2.4,
    attack: 1.2,
  },
  inner_demon_grand: {
    title: '大执念劫',
    name: '执念化身',
    hp: 1.1,
    attack: 1.1,
  },
  heavenly_tribulation_final: {
    title: '天劫前奏',
    name: '天道劫影',
    hp: 2.6,
    attack: 1.25,
  },
} as const;
export type BreakthroughChallengeId = keyof typeof BREAKTHROUGH_CHALLENGES;
export const BREAKTHROUGH_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  rulesetVersion: 'daoyou_rules_v8',
  contentVersion: 'combat-v6-breakthrough-v1',
} as const;

export interface BreakthroughSnapshot extends PveRestoredState {
  version: 'breakthrough-v6-battle-v1';
  playerId: string;
  input: Omit<CreateBattleInput, 'ruleset'>;
}

export class BreakthroughHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      BreakthroughSnapshot,
      'version' | 'playerId' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'breakthrough-v6-battle-v1' ||
      source.input.versions?.contentVersion !==
        BREAKTHROUGH_VERSIONS.contentVersion
    )
      throw new Error('突破战斗版本无法恢复');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: Object.fromEntries(
          source.input.units
            .filter((unit) => unit.side === 1)
            .map((unit) => [unit.id!, { type: 'automatic' as const }]),
        ),
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
    );
  }
  runtimeSnapshot(): BreakthroughSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createBreakthroughHost(
  player: CombatV6TrainingPlayerInput,
  challengeId: BreakthroughChallengeId,
  clearMind: boolean,
  seed: number,
) {
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑并恢复气血');
  const spec = BREAKTHROUGH_CHALLENGES[challengeId];
  const level = projected.unit.level!;
  const mirror =
    challengeId === 'heart_demon_nascent' ||
    challengeId === 'inner_demon_grand';
  let opponent: CreateBattleInput['units'][number];
  if (mirror) {
    const enemy = projectCharacterToCombatV6({
      ...player,
      side: 1,
      slot: 0,
      resourcePolicy: 'full',
    });
    if (!enemy.ok) throw new Error('心魔构筑无效');
    opponent = structuredClone(enemy.unit);
    opponent.id = `breakthrough.enemy.${challengeId}`;
    opponent.name = spec.name;
    const factor =
      challengeId === 'heart_demon_nascent' && !clearMind ? 1.1 : spec.attack;
    for (const key of ['maxHp', 'physicalAtk', 'magicAtk'] as const)
      opponent.attrs![key] = Math.round(opponent.attrs![key]! * factor);
    opponent.attrs!.hp = opponent.attrs!.maxHp!;
  } else {
    const hp = Math.round((100 + level * 20) * spec.hp);
    const attack = Math.round((15 + level * 5) * spec.attack);
    opponent = {
      id: `breakthrough.enemy.${challengeId}`,
      name: spec.name,
      kind: 'npc',
      side: 1,
      slot: 0,
      level,
      attrs: {
        hp,
        maxHp: hp,
        mp: level * 10 + 100,
        maxMp: level * 10 + 100,
        physicalAtk: attack,
        magicAtk: attack,
        physicalDef: 10 + level * 3,
        magicDef: 10 + level * 3,
        speed: 10 + level * 3,
      },
      skills: ['beast.spirit-flame', 'beast.wind-strike'],
      skillLevels: { 'beast.spirit-flame': level, 'beast.wind-strike': level },
    };
  }
  return new BreakthroughHost({
    version: 'breakthrough-v6-battle-v1',
    playerId: projected.unit.id!,
    input: structuredClone({
      seed,
      versions: BREAKTHROUGH_VERSIONS,
      units: [
        projected.unit,
        ...projectBeastRoster(player.beasts, projected.unit.id!, 0, 0, level),
        opponent,
      ],
      skills: [...BEAST_SKILLS, ...projected.skills],
      statusDefs: projected.statusDefs,
    }),
  });
}
