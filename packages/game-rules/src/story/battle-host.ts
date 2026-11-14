import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import {
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  type CombatV6TrainingPlayerInput,
  type PveRestoredState,
} from '@daoyou/game-domain/combat';
import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';
import type { StoryBattleSnapshot } from '@daoyou/game-domain/combat/challenges';
import type {
  StoryBattle,
  StoryBattleOutcome,
} from '@daoyou/game-domain/story';

import { projectBeastRoster } from '../beasts/projection.js';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';
import { CombatV6PveHostSession } from '../combat/encounter/host.js';
import { presetEnemyAttrs } from '../combat/encounter/preset-enemy.js';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { playerAppearances } from '../combat/unit-appearance.js';

const STORY_BATTLE_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v13',
  contentVersion: 'combat-v6-story-v1',
} as const;

/** 剧情战的战局：玩家一方对主线指定的对手，用的是全游戏同一套战斗规则。 */
export class StoryBattleHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      StoryBattleSnapshot,
      'version' | 'playerId' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (source.version !== 'story-v6-battle-v1')
      throw new Error('剧情战版本无法恢复');
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
  runtimeSnapshot(): StoryBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createStoryBattleHost(
  player: CombatV6TrainingPlayerInput,
  battle: StoryBattle,
  seed: number,
) {
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: battle.fresh ? 'full' : 'persistent',
  });
  if (!projected.ok) throw new Error('眼下的状态还不能迎战');
  const opponents = battle.opponents.map((spec, slot) => {
    const attrs = presetEnemyAttrs(
      spec.level,
      spec.kind,
      battle.opponents.length,
    );
    attrs.hp = attrs.maxHp = Math.max(1, Math.round(attrs.maxHp * spec.hp));
    attrs.physicalAtk = Math.max(1, Math.round(attrs.physicalAtk * spec.attack));
    attrs.magicAtk = Math.max(1, Math.round(attrs.magicAtk * spec.attack));
    return {
      id: `story.enemy.${battle.id}.${slot}`,
      name: spec.name,
      kind: 'npc' as const,
      side: 1 as const,
      slot,
      level: spec.level,
      attrs,
      skills: [],
      passives: [],
    };
  });
  return new StoryBattleHost({
    version: 'story-v6-battle-v1',
    playerId: projected.unit.id!,
    input: structuredClone({
      autoStrategy: player.autoStrategy,
      unitAppearances: {
        ...playerAppearances(player),
        ...Object.fromEntries(
          opponents.flatMap((opponent, slot) => {
            const icon = battle.opponents[slot]?.icon;
            return icon ? [[opponent.id, { icon }]] : [];
          }),
        ),
      },
      seed,
      versions: STORY_BATTLE_VERSIONS,
      units: [
        projected.unit,
        ...projectBeastRoster(
          player.beasts,
          projected.unit.id!,
          0,
          0,
          projected.unit.level!,
        ),
        ...opponents,
      ],
      skills: [...BEAST_SKILLS, ...projected.skills],
      statusDefs: [...projected.statusDefs, ...BEAST_STATUS_DEFS],
    }),
  });
}

/**
 * 这一场眼下算什么结果。还没打完、也没到收场的回合就是空。
 * 赢了算赢；到了收场回合还没分胜负，算有人出手；其余都算输。
 */
export function storyBattleOutcome(
  battle: StoryBattle,
  state: { finished: boolean; outcome?: string; round: number },
): StoryBattleOutcome | null {
  if (state.finished) return state.outcome === 'victory' ? 'won' : 'lost';
  if (battle.rescueAfter && state.round > battle.rescueAfter) return 'rescued';
  return null;
}
