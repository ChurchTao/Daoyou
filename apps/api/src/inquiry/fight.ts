import { getMapNode } from '@daoyou/game-content/world/map';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { automaticCommands } from '@daoyou/game-rules/combat/auto';
import { createDungeonHost } from '@daoyou/game-rules/combat/dungeon/host';
import { beastVictoryExperience } from '@daoyou/game-rules/beasts/growth';
import { resolveDungeonMapConfig } from '@daoyou/game-rules/world/dungeon';
import { assembleCombatV6WildPlayer } from '@server/combat/application/CombatV6BuildService.js';
import type { DbExecutor } from '@server/lib/drizzle/db.js';
import type { RealmType } from '@daoyou/constants/realms';
import { randomInt } from 'node:crypto';

/** Resolve the casket fight with the character's saved auto strategy. */
export async function fightInquiryCasket(owner: string, mapNodeId: string, tx: DbExecutor) {
  const { player } = await assembleCombatV6WildPlayer(owner, tx);
  const map = getMapNode(mapNodeId);
  if (!map || !('realm_requirement' in map)) throw new Error('秘境地图无效');
  const level = getRealmStageLevel(map.realm_requirement as RealmType, '初期');
  const host = createDungeonHost(
    player,
    level,
    'normal',
    randomInt(0, 0x7fffffff),
    resolveDungeonMapConfig(map).difficultyTier,
  );
  let guard = 0;
  while (!host.finished && guard < 40) {
    const commands = automaticCommands(
      host.state,
      host.playerId,
      host.runtimeSnapshot().input.skills ?? [],
      (id) => host.controlledCommandOptions().find((option) => option.unitId === id)!,
      {
        statusDefs: host.runtimeSnapshot().input.statusDefs,
        strategies: { [host.playerId]: host.playerAutoStrategy },
      },
    );
    if (commands.length) host.submitGroup(commands);
    host.resolveRound(() => undefined);
    guard += 1;
  }
  if (!host.finished) throw new Error('守剑傀的战斗没有结束');
  const unit = host.state.units.find((candidate) => candidate.id === host.playerId);
  return {
    victory: host.trace().outcome === 'victory',
    beastExperience: host.trace().outcome === 'victory'
      ? beastVictoryExperience(host.state, host.playerId)
      : undefined,
    hp: unit?.attrs.hp ?? 1,
    mp: unit?.attrs.mp ?? 0,
    maxHp: unit?.attrs.maxHp ?? 1,
    maxMp: unit?.attrs.maxMp ?? 0,
  };
}
