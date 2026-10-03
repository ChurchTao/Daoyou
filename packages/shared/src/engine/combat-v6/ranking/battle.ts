import { playerAppearances, type PresentedBattleInput } from '../../../combat-v6/unit-appearance.js';
import {
  AUTO_POLICY_VERSION,
  automaticCommands,
} from '../../../combat-v6/auto.js';
import {
  replayRound,
  startReplayTimeline,
} from '../../../combat-v6/replay-timeline.js';
import { BEAST_STATUS_DEFS, BEAST_SKILLS, projectBeastRoster } from '../beasts/index.js';
import {
  createBattle,
  type CreateBattleInput,
  type SkillDef,
  type StatusDef,
} from '../core/index.js';
import type { CombatV6TrainingPlayerInput } from '../encounter/index.js';
import { projectCharacterToCombatV6 } from '../projection/index.js';
import { characterBattleSkills } from '../projection/character-battle-skills.js';
import { daoyouRulesetV6 } from '../rules-daoyou/index.js';
import type { AutoStrategy } from '../../../combat-v6/auto-strategy.js';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS } from '../version.js';

export type RankingBattleInput = PresentedBattleInput & {
  seed: number;
  autoStrategies?: Record<string, AutoStrategy>;
};

export function compileRankingBattle(
  players: [CombatV6TrainingPlayerInput, CombatV6TrainingPlayerInput],
  seed: number,
): RankingBattleInput {
  if (players[0].cultivator.id === players[1].cultivator.id)
    throw new Error('不能挑战自己');
  const units: CreateBattleInput['units'] = [];
  const skills = new Map<string, SkillDef>(BEAST_SKILLS.map((s) => [s.id, s]));
  const statuses = new Map<string, StatusDef>(BEAST_STATUS_DEFS.map(s => [s.id, s]));
  const autoStrategies: Record<string, AutoStrategy> = {};
  function merge<T extends { id: string }>(map: Map<string, T>, values: T[]) {
    for (const value of values) {
      if (
        map.has(value.id) &&
        JSON.stringify(map.get(value.id)) !== JSON.stringify(value)
      )
        throw new Error(`战斗定义冲突：${value.id}`);
      map.set(value.id, value);
    }
  }
  players.forEach((player, index) => {
    const side = index as 0 | 1;
    const p = projectCharacterToCombatV6({
      ...player,
      side,
      slot: 0,
      resourcePolicy: 'full',
    });
    if (!p.ok) throw new Error('天骄榜构筑无法编译');
    if (player.autoStrategy) autoStrategies[p.unit.id!] = player.autoStrategy;
    units.push(
      characterBattleSkills(p.unit, p.skills, skills),
      ...projectBeastRoster(
        player.beasts,
        p.unit.id!,
        side,
        0,
        p.unit.level,
      ).filter((b) => !b.benched),
    );
    merge(statuses, p.statusDefs);
  });
  return structuredClone({
    unitAppearances: Object.assign({}, ...players.map(playerAppearances)),
    seed,
    units,
    skills: [...skills.values()],
    statusDefs: [...statuses.values()],
    autoStrategies,
    versions: {
      ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
      autoPolicyVersion: AUTO_POLICY_VERSION,
      rulesetVersion: 'daoyou_rules_v11',
      contentVersion: 'combat-v6-ranking-v1',
    },
  });
}

/** Both sides plan from the same observation boundary; timeout filling stays separate. */
export function simulateRankingBattle(input: RankingBattleInput) {
  const strategies =
    input.versions.autoPolicyVersion === AUTO_POLICY_VERSION
      ? input.autoStrategies
      : undefined;
  const battle = createBattle({
    ...structuredClone(input),
    ruleset: daoyouRulesetV6,
  });
  const statuses = input.statusDefs ?? [];
  const timeline = startReplayTimeline(
    battle.snapshot(),
    statuses,
    battle.log().length - 1,
    input.unitAppearances,
  );
  const rounds = [];
  while (!battle.finished) {
    const state = battle.snapshot();
    const commands = state.units
      .filter((unit) => unit.kind === 'player')
      .flatMap((unit) =>
        automaticCommands(
          state,
          unit.id,
          input.skills ?? [],
          (id) => battle.queryCommands(id),
          { statusDefs: statuses, strategies },
        ),
      );
    for (const entry of commands) battle.submit(entry.unitId, entry.command);
    rounds.push({
      round: state.round,
      commands: battle
        .snapshot()
        .units.flatMap((u) =>
          u.command ? [{ unitId: u.id, command: u.command }] : [],
        ),
    });
    const recording = replayRound(
      timeline,
      battle.snapshot(),
      statuses,
      battle.log().length - 1,
    );
    battle.lockAndResolve(recording.capture);
    recording.finish(battle.snapshot(), battle.log().length - 1);
  }
  return {
    seed: input.seed,
    initialUnits: input.units,
    skills: input.skills ?? [],
    statusDefs: statuses,
    rounds,
    events: [...battle.log()],
    timeline,
    finalState: battle.snapshot(),
  };
}
