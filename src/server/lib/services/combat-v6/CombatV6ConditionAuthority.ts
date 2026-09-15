import { readCharacterCombatBuild } from '@server/lib/repositories/characterLoadoutRepository';
import type { DbExecutor } from '@server/lib/drizzle/db';
import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import {
  characterIdentityRow,
} from '@server/lib/repositories/sectCombatRepository';
import { projectCharacterDisplay } from '@shared/lib/cultivatorDisplay';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { CombatV6WildStore } from './CombatV6WildStore';
import { activeSectTaskBattle } from './CombatV6SectTaskOccupancy';
import { activeBreakthroughBattle } from './CombatV6BreakthroughOccupancy';
import { SectTaskRecordPayloadSchema } from '@shared/engine/sect';
import { SectV6TargetSchema } from '@shared/contracts/combatV6SectTask';

/** Read-model annotation only. Never persisted into cultivators.condition. */
export async function readCombatV6ConditionAuthority(
  id: string,
  q: DbExecutor,
) {
  const build = await readCharacterCombatBuild(id, q);
  const row = await characterIdentityRow(id, q);
  if (!row) throw new Error('角色不存在');
  const attrs = projectCharacterDisplay({
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
      build,
      maxHp: summary.entry.maxHp,
      maxMp: summary.entry.maxMp,
      recoveryPaused: true,
    };
  }
  const taskBattle = await activeSectTaskBattle(id, q);
  const taskTarget = taskBattle ? SectV6TargetSchema.parse(
    SectTaskRecordPayloadSchema.parse(taskBattle.payload).executorData.battleTarget,
  ) : undefined;
  return {
    attrs,
    build,
    maxHp: attrs.maxHp,
    maxMp: attrs.maxMp,
    recoveryPaused: (await hasActiveDungeon(id)) || taskTarget?.resourcePolicy === 'persistent' ||
      !!(await activeBreakthroughBattle(id, q)),
  };
}
