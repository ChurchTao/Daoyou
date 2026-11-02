import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { SectV6View } from '@daoyou/contracts/sects/combat';
import type { SectV6Action } from '@daoyou/game-domain/sects/commands';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { MeridianEditor } from './MeridianEditor';
import { MethodsWorkbench } from './MethodsWorkbench';
import { SectPathChoice } from './SectPathChoice';

const endpoint = '/api/combat-v6/sect';
export type SectWorkspaceMode = 'methods' | 'paths';
export function SectWorkspace({
  mode,
  onExit,
}: {
  mode: SectWorkspaceMode;
  onExit: () => void;
}) {
  const [view, setView] = useState<SectV6View>();
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { pushToast } = useInkUI();
  const busy = useRef(false);
  const alive = useRef(true);
  const reader = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      reader.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
    void combatV6Request<SectV6View>(endpoint, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setView(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [refresh]);
  async function request(url: string, input: unknown) {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError('');
    reader.current?.abort();
    try {
      await consumeResourceMutation(
        await apiFetch(url, {
          ...mutationBody(input),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const latest = await combatV6Request<SectV6View>(endpoint);
      if (alive.current) {
        setView(latest);
        pushToast({ message: '传承已更新，下一场战斗生效。', tone: 'success' });
      }
      return true;
    } catch (e) {
      if (alive.current)
        setError(
          `${e instanceof Error ? e.message : '保存失败'}；草稿仍保留。重新读取会放弃草稿，并更新传承与资源状态。`,
        );
      return false;
    } finally {
      busy.current = false;
      if (alive.current) {
        setPending(false);
      }
    }
  }
  const act = (action: SectV6Action) => request(endpoint, action);
  return (
    <div className="p-3 text-sm md:p-5 [&>p]:mb-4">
      {error ? (
        <p role="alert" className="text-crimson">
          {error}{' '}
          <button
            className="underline"
            disabled={pending}
            onClick={() => {
              setError('');
              setRefresh((n) => n + 1);
            }}
          >
            重新读取
          </button>
        </p>
      ) : null}
      {!view ? (
        <p>正在读取传承……</p>
      ) : !view.progress ? (
        <>
          <p>{view.blockedReason}</p>
          <InkButton disabled={pending} onClick={onExit}>
            返回
          </InkButton>
        </>
      ) : (
        <>
          {view.blockedReason ? (
            <p role="status">{view.blockedReason}</p>
          ) : null}
          {mode === 'paths' && view.progress.activePathId ? (
            <MeridianEditor
              key={`${view.build.membershipId}:${refresh}`}
              view={view}
              pending={pending}
              act={act}
              onExit={onExit}
            />
          ) : (
            <>
              <div className="flex justify-end">
                <InkButton disabled={pending} onClick={onExit}>
                  返回
                </InkButton>
              </div>
              {mode === 'paths' ? (
                <SectPathChoice
                  paths={view.build.paths}
                  pending={pending}
                  disabled={!!view.blockedReason}
                  onChoose={(activePathId) =>
                    void request('/api/combat-v6/sect/path', {
                      activePathId,
                      expectedRevision: view.build.revision,
                    })
                  }
                />
              ) : (
                <>
                  {!view.progress.activePathId ? (
                    <p className="text-ink-secondary mt-3 text-sm leading-7">
                      心法可先研习，流派决定后续经脉与战斗特点。
                    </p>
                  ) : null}
                  <MethodsWorkbench
                    key={view.build.membershipId}
                    view={view}
                    pending={pending}
                    act={act}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
