import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui/InkButton';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  TowerSessionView,
  TowerView,
} from '@shared/contracts/combatV6Tower';
import { useNavigate } from 'react-router';

export default function TowerBattleRoute() {
  const combat = useCombatV6Session<TowerSessionView>('/api/tower/battle');
  const navigate = useNavigate();
  const { reload: reloadCurrency } = useCultivatorCurrency();
  function finish() {
    if (combat.playing || !combat.session?.outcome) return;
    void combat.run(async () => {
      const view = await combatV6Request<TowerView>('/api/tower/state');
      if (view.state?.battleId)
        await combatV6Request<TowerView>(
          '/api/tower/action',
          mutationBody({
            runId: view.state.runId,
            revision: view.state.revision,
            action: 'complete',
          }),
        );
      void reloadCurrency();
      navigate('/game/tower', { replace: true });
    });
  }
  return (
    <CombatV6Page title="蜃楼幻境" active>
      {combat.error ? (
        <p role="alert">
          {combat.error}{' '}
          <InkButton onClick={() => void combat.refresh(true)}>重试</InkButton>
        </p>
      ) : null}
      {combat.session?.settlement === 'pending' ? (
        <InkButton
          pending={combat.pending}
          onClick={() => void combat.resolve()}
        >
          重试结算
        </InkButton>
      ) : null}
      {combat.session ? (
        <CombatV6Battle
          allowAbandon={false}
          title="蜃楼幻境"
          session={combat.session}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={finish}
          back="/game/tower"
          backLabel="返回幻境"
        />
      ) : (
        <p>
          {combat.loading ? '正在恢复战局…' : '当前战局已结束或失效。'}{' '}
          <InkButton href="/game/tower">返回幻境</InkButton>
        </p>
      )}
    </CombatV6Page>
  );
}
