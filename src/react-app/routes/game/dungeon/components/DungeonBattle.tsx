import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { DungeonSessionView } from '@shared/contracts/combatV6Dungeon';
import type { ResourceOperation } from '@shared/engine/resource/types';
import type {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@shared/lib/dungeon/types';
import type { Cultivator } from '@shared/types/cultivator';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}
export function DungeonBattle({
  battleId,
  onBattleComplete,
}: {
  battleId: string;
  player: Pick<Cultivator, 'id'>;
  onBattleComplete: (data: BattleCallbackData | null) => void;
}) {
  const combat = useCombatV6Session<DungeonSessionView>('/api/dungeon/battle');
  const finish = () => {
    if (!combat.session?.outcome || combat.playing) return;
    void combat.run(async () => {
      const response = await fetch('/api/dungeon/battle/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, requestId: battleId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '秘境恢复失败');
      const result = await consumeResourceMutation<{
        callbackData: BattleCallbackData;
      }>(body);
      onBattleComplete(result.callbackData);
    });
  };
  return (
    <CombatV6Page title="秘境遭遇" active>
      {combat.error ? (
        <p role="alert">
          {combat.error}{' '}
          <InkButton onClick={() => void combat.refresh(true)}>重试</InkButton>
        </p>
      ) : null}
      {combat.session ? (
        <CombatV6Battle
          allowAbandon={false}
          key={battleId}
          title="秘境遭遇"
          session={combat.session}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={finish}
          back="/game/dungeon"
          backLabel="返回秘境"
        />
      ) : (
        <p>正在恢复遭遇战…</p>
      )}
    </CombatV6Page>
  );
}
