import {
  BREAKTHROUGH_CHALLENGES,
  BREAKTHROUGH_SKILLS,
  BREAKTHROUGH_STATUS_DEFS,
} from '@daoyou/game-content/combat/breakthrough';
import type {
  BreakthroughChallengeId,
  BreakthroughSnapshot,
} from '@daoyou/game-domain/combat/challenges';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';

import { playerAppearances } from '../unit-appearance.js';

import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../../beasts/projection.js';

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
  rulesetVersion: 'daoyou_rules_v12',
  contentVersion: 'combat-v6-breakthrough-v2',
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
      ![
        'combat-v6-breakthrough-v1',
        BREAKTHROUGH_VERSIONS.contentVersion,
      ].includes(source.input.versions?.contentVersion ?? '')
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
  const level = getRealmStageLevel(spec.fromRealm, '圆满');
  const attrs = presetEnemyAttrs(level, 'boss');
  const mindFactor =
    challengeId === 'heart_demon_nascent' && !clearMind ? 1.1 : 1;
  attrs.hp = attrs.maxHp = Math.round(
    ((attrs.maxHp * spec.hp) / 2.5) * mindFactor,
  );
  attrs.physicalAtk = Math.round(
    ((attrs.physicalAtk * spec.attack) / 1.3) *
      mindFactor *
      (spec.attackType === 'spell' ? 0.65 : 1),
  );
  attrs.magicAtk = Math.round(
    ((attrs.magicAtk * spec.attack) / 1.3) * mindFactor,
  );
  const enemySkills = BREAKTHROUGH_SKILLS.filter((skill) =>
    spec.skills.some((id) => id === skill.id),
  );
  const opponent = {
    id: `breakthrough.enemy.${challengeId}`,
    name: spec.name,
    kind: 'npc' as const,
    side: 1 as const,
    slot: 0,
    level,
    attrs,
    skills: enemySkills
      .filter((skill) => !skill.tags.includes('passive'))
      .map((skill) => skill.id),
    passives: enemySkills
      .filter((skill) => skill.tags.includes('passive'))
      .map((skill) => skill.id),
    skillLevels: Object.fromEntries(spec.skills.map((id) => [id, level])),
  };
  return new BreakthroughHost({
    version: 'breakthrough-v6-battle-v1',
    playerId: projected.unit.id!,
    input: structuredClone({
      autoStrategy: player.autoStrategy,
      unitAppearances: {
        ...playerAppearances(player),
        [opponent.id]: { icon: `icon:breakthrough-${challengeId}` },
      },
      seed,
      versions: BREAKTHROUGH_VERSIONS,
      units: [
        projected.unit,
        ...projectBeastRoster(
          player.beasts,
          projected.unit.id!,
          0,
          0,
          projected.unit.level!,
        ),
        opponent,
      ],
      skills: [...BEAST_SKILLS, ...projected.skills, ...BREAKTHROUGH_SKILLS],
      statusDefs: [
        ...projected.statusDefs,
        ...BEAST_STATUS_DEFS,
        ...BREAKTHROUGH_STATUS_DEFS,
      ],
    }),
  });
}
