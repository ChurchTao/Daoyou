import { projectCombatV6Condition } from './CombatV6ConditionProjector';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { wildTerminal } from './CombatV6WildSessionService';
import { CombatV6WildStore } from './CombatV6WildStore';

/** Transfer continues only after the old battle's resource transaction committed. */
export async function settleWildBeforeMembershipChange(cultivatorId: string) {
  const store = new CombatV6WildStore();
  const lockedId = await store.lock(cultivatorId);
  const id = lockedId ?? await new CombatV6RuntimeStore().currentId(cultivatorId);
  if (!id) return;
  if(!lockedId){const runtime=await store.get(id);if(runtime?.host.state.result)await store.clearFinished(runtime,runtime.revision);return;}
  const summary = await store.summary(id);
  if (!summary) throw new Error('WILD_SETTLEMENT_MISSING');
  if (!(await new CombatV6RuntimeStore().terminalRecord(id))) {
    const result = await store.finish(
      summary,
      wildTerminal(summary, 'membership-changed'),
    );
    if (result !== 'OK') throw new Error('战斗正在推进，请稍后重试宗门变更');
  }
  await projectCombatV6Condition(id);
  const runtime = await store.get(id);
  if (runtime) await store.clearFinished(runtime, runtime.revision);
}
