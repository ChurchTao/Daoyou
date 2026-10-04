import { BREAKTHROUGH_CHALLENGES } from '@daoyou/game-content/combat/breakthrough';
import type { BreakthroughChallengeId, BreakthroughSnapshot } from '@daoyou/game-domain/combat/challenges';

import { playerAppearances } from '../unit-appearance.js';

import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import { BEAST_STATUS_DEFS, BEAST_SKILLS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../../beasts/projection.js';

import type { CreateBattleInput } from '@daoyou/combat-core/types';

import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';

import {
  type PveRestoredState,
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
} from '@daoyou/game-domain/combat';

import { CombatV6PveHostSession } from '../encounter/host.js';

import { projectCharacterToCombatV6 } from '../projection/project-character.js';

import { daoyouRulesetV6 } from '../daoyou/index.js';


import { presetEnemyAttrs } from '../encounter/preset-enemy.js';

export const BREAKTHROUGH_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v11',
  contentVersion: 'combat-v6-breakthrough-v1',
} as const;

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
        sourceProjectionVersions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        playerAutoStrategy: source.input.autoStrategy,
      },
      restored,
      source.input.unitAppearances,
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
    const attrs = presetEnemyAttrs(level, 'boss');
    attrs.hp = attrs.maxHp = Math.round(attrs.maxHp * spec.hp / 2.5);
    attrs.physicalAtk = Math.round(attrs.physicalAtk * spec.attack / 1.3);
    attrs.magicAtk = Math.round(attrs.magicAtk * spec.attack / 1.3);
    opponent = {
      id: `breakthrough.enemy.${challengeId}`,
      name: spec.name,
      kind: 'npc',
      side: 1,
      slot: 0,
      level,
      attrs,
      skills: ['beast.spirit-flame'],
      skillLevels: { 'beast.spirit-flame': level },
    };
  }
  return new BreakthroughHost({
    version: 'breakthrough-v6-battle-v1',
    playerId: projected.unit.id!,
    input: structuredClone({
      autoStrategy: player.autoStrategy,
      unitAppearances: playerAppearances(player),
      seed,
      versions: BREAKTHROUGH_VERSIONS,
      units: [
        projected.unit,
        ...projectBeastRoster(player.beasts, projected.unit.id!, 0, 0, level),
        opponent,
      ],
      skills: [...BEAST_SKILLS, ...projected.skills],
      statusDefs: [...projected.statusDefs, ...BEAST_STATUS_DEFS],
    }),
  });
}
