import { redis } from '@server/lib/redis/index.js';
import { arenaOccupancyKey, CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { hasTowerBattle } from '@server/tower/occupancy.js';
import { readCharacterCombatBuild } from '@server/lib/repositories/characterLoadoutRepository.js';
import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { hasActiveDungeon } from '@server/dungeon/occupancy.js';
import {
  characterIdentityRow,
} from '@server/lib/repositories/sectCombatRepository.js';
import { projectCharacterDisplaySnapshot } from '@daoyou/shared/lib/cultivatorDisplay';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import type { RealmStage, RealmType } from '@daoyou/shared/types/constants';
import { CombatV6WildStore } from '@server/combat/application/CombatV6WildStore.js';
import { activeSectTaskBattle } from '@server/combat/application/CombatV6SectTaskOccupancy.js';
import { activeBreakthroughBattle } from '@server/combat/application/CombatV6BreakthroughOccupancy.js';
import { SectTaskRecordPayloadSchema } from '@daoyou/shared/engine/sect';
import { SectV6TargetSchema } from '@daoyou/shared/contracts/combatV6SectTask';

/** Read-model annotation only. Never persisted into cultivators.condition. */
export async function readCombatV6ConditionAuthority(
  id: string,
  q: DbExecutor,
) {
  const build = await readCharacterCombatBuild(id, q);
  const row = await characterIdentityRow(id, q);
  if (!row) throw new Error('角色不存在');
  const { attrs, effectiveAttributes } = projectCharacterDisplaySnapshot({
    id: row.id, name: row.name, realm: row.realm as RealmType, realm_stage: row.realm_stage as RealmStage,
    attributes: { vitality: row.vitality, strength: row.strength, spirit: row.spirit, endurance: row.endurance, speed: row.speed, willpower: row.willpower },
    condition: (row.condition as CultivatorCondition | null) ?? undefined,
  }, build);
  const store = new CombatV6WildStore();
  const lock = await store.lock(id);
  if (lock) {
    const summary = await store.summary(lock);
    if (!summary) throw new Error('WILD_SETTLEMENT_MISSING');
    return {
      attrs,
      effectiveAttributes,
      build,
      maxHp: summary.entry.maxHp,
      maxMp: summary.entry.maxMp,
      recoveryPaused: true,
    };
  }
  const arenaId = await redis.get(arenaOccupancyKey(id));
  if (arenaId) {
    const runtime = await new CombatV6ArenaStore().get(arenaId);
    if (!runtime) throw new Error('ARENA_RESOURCE_AUTHORITY_MISSING');
    if (runtime.huntResourcePolicy === 'persistent') {
      const participant = runtime.participants.find((p) => p.cultivatorId === id);
      const entry = runtime.units.find((u) => u.id === participant?.unitId)?.attrs;
      if (!entry?.maxHp || entry.maxMp === undefined) throw new Error('HUNT_RESOURCES_MISSING');
      return { attrs, effectiveAttributes, build, maxHp: entry.maxHp, maxMp: entry.maxMp, recoveryPaused: true };
    }
  }
  const taskBattle = await activeSectTaskBattle(id, q);
  const taskTarget = taskBattle ? SectV6TargetSchema.parse(
    SectTaskRecordPayloadSchema.parse(taskBattle.payload).executorData.battleTarget,
  ) : undefined;
  return {
    attrs,
    effectiveAttributes,
    build,
    maxHp: attrs.maxHp,
    maxMp: attrs.maxMp,
    recoveryPaused: (await hasTowerBattle(id)) || (await hasActiveDungeon(id)) || taskTarget?.resourcePolicy === 'persistent' ||
      !!(await activeBreakthroughBattle(id, q)),
  };
}
