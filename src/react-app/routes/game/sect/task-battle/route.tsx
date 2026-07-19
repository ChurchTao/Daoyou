import { decodeSectTaskOutcome } from '@app/components/feature/sect/sectTaskOutcomeRegistry';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { sectPresentationRegistry } from '@app/lib/sect/presentation/compositionRoot';
import { startSectTaskBattleOnce } from '@app/lib/sect/sectClient';
import type { SectTaskActionData } from '@shared/contracts/sect';
import { createElement, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SectPermissionBoundary } from '../components/SectScene';

export default function SectTaskBattlePage() {
  return (
    <SectPermissionBoundary permission="sect.tasks.use" title="宗门战局">
      <SectTaskBattleBody />
    </SectPermissionBoundary>
  );
}

function SectTaskBattleBody() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [result, setResult] = useState<SectTaskActionData>();
  const [error, setError] = useState<string>();
  const parameterError = !taskId || !attemptId ? '缺少宗门战斗标识' : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!taskId || !attemptId) return;
    void startSectTaskBattleOnce(taskId, attemptId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '宗门战局推演失败');
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, taskId]);

  if (error || parameterError)
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="mb-4 text-crimson">{error ?? parameterError}</p>
          <InkButton onClick={() => navigate('/game/sect/affairs')}>
            返回执事堂
          </InkButton>
        </div>
      </div>
    );

  if (!result) return <GameImmersiveLoading message="宗门战局推演中……" />;

  const decoded = decodeSectTaskOutcome(result.outcome);
  const contribution = decoded.ok
    ? sectPresentationRegistry().outcome(decoded.value.renderer)
    : undefined;
  if (!decoded.ok || !contribution)
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="mb-4 text-crimson">
            {decoded.ok ? '暂不支持此宗门战斗结果' : decoded.error}
          </p>
          <InkButton onClick={() => navigate('/game/sect/affairs')}>
            返回执事堂
          </InkButton>
        </div>
      </div>
    );
  return createElement(contribution.renderer, {
    task: result.task,
    data: decoded.value.data,
  });
}
