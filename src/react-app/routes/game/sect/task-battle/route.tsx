import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import {
  getSectTaskActivityLocation,
  resolveSectTaskActivityOrigin,
} from '@app/components/feature/sect/sectTaskActivityLocations';
import { InkButton } from '@app/components/ui';
import { startSectTaskBattleOnce } from '@app/lib/sect/sectClient';
import type { SectTaskSessionView } from '@shared/contracts/combatV6SectTask';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SectPermissionBoundary } from '../components/SectScene';

const base = '/api/combat-v6/sect-tasks';
export default function SectTaskBattlePage() {
  return (
    <SectPermissionBoundary permission="sect.tasks.use" sceneKey="taskBattle">
      <SectTaskBattleBody />
    </SectPermissionBoundary>
  );
}
function SectTaskBattleBody() {
  const combat = useCombatV6Session<SectTaskSessionView>(base);
  const tasks = useSectTasksQuery();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [params] = useSearchParams();
  const attemptId = params.get('attemptId');
  const origin = resolveSectTaskActivityOrigin(params.get('origin'));
  const task = tasks.data?.items.find(
    (item) => item.definitionId === (combat.session?.taskId ?? taskId),
  );
  const back = origin
    ? getSectTaskActivityLocation(origin, task, 'return').route
    : '/game/sect/affairs';
  const [startError, setStartError] = useState('');
  const started = useRef(false);
  const { loading, session, acceptSession } = combat;
  const { invalidate: invalidateTasks } = tasks;
  useEffect(() => {
    if (session?.settlement === 'settled') invalidateTasks();
  }, [session?.sessionId, session?.settlement, invalidateTasks]);
  useEffect(() => {
    if (loading || session || started.current || !taskId || !attemptId) return;
    started.current = true;
    void startSectTaskBattleOnce(taskId, attemptId)
      .then(async (result) => {
        const battleId = result.outcome.data.battleId;
        if (typeof battleId !== 'string')
          throw new Error('旧版战斗入口已停止，请重新进入任务');
        acceptSession(
          await combatV6Request<SectTaskSessionView>(
            `${base}/sessions/${battleId}`,
          ),
        );
      })
      .catch((error: unknown) =>
        setStartError(error instanceof Error ? error.message : '开战失败'),
      );
  }, [loading, session, taskId, attemptId, acceptSession]);
  const error =
    combat.error ||
    startError ||
    (!taskId || !attemptId ? '缺少宗门挑战标识' : '');
  return (
    <CombatV6Page title="宗门挑战" active>
      {error ? (
        <p role="alert">
          {error}{' '}
          <InkButton onClick={() => startError ? navigate(0) : void combat.refresh(true)}>
            刷新战局
          </InkButton>
        </p>
      ) : null}
      {session?.settlement === 'pending' ? (
        <InkButton
          pending={combat.pending}
          onClick={() => void combat.resolve()}
        >
          重试结算
        </InkButton>
      ) : null}
      {session ? (
        <CombatV6Battle
          allowAbandon={false}
          title="宗门挑战"
          session={session}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={() => {
            if (session.settlement === 'settled' && !combat.playing)
              navigate(back, { replace: true });
          }}
          back={back}
          backLabel="返回任务地点"
        />
      ) : (
        <p>
          {error ? '尚未进入战斗。' : '正在准备战局…'}{' '}
          <InkButton href={back}>返回任务地点</InkButton>
        </p>
      )}
    </CombatV6Page>
  );
}
