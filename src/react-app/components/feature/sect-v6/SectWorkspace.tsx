import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { SectV6Action, SectV6View } from '@shared/contracts/combatV6Sect';
import { sectSkillCatalog } from '@shared/engine/combat-v6/sect-progression/presentation';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { MeridianEditor } from './MeridianEditor';
import { MethodsWorkbench } from './MethodsWorkbench';

const endpoint = '/api/combat-v6/sect';
export type SectWorkspaceMode = 'methods' | 'paths' | 'skills';
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
        await fetch(url, {
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
          `${e instanceof Error ? e.message : '请求失败'}；草稿仍保留。重新读取将放弃草稿并核对最新传承与资源。`,
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
          {view.build.paths.map((path) => (
            <InkButton
              key={path.id}
              pending={pending}
              disabled={view.blockedReason !== '请先选择流派，启用宗门传承'}
              onClick={() =>
                void request('/api/combat-v6/build/initialize', {
                  activePathId: path.id,
                  expectedRevision: view.build.revision,
                })
              }
            >
              启用{path.name}
            </InkButton>
          ))}
          <InkButton disabled={pending} onClick={onExit}>
            返回
          </InkButton>
        </>
      ) : (
        <>
          {view.blockedReason ? (
            <p role="status">{view.blockedReason}</p>
          ) : null}
          {mode === 'paths' ? (
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
              {mode === 'methods' ? (
                <MethodsWorkbench
                  key={view.build.membershipId}
                  view={view}
                  pending={pending}
                  act={act}
                />
              ) : (
                <Skills view={view} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Skills({ view }: { view: SectV6View }) {
  const skills = sectSkillCatalog(view.progress!, view.characterLevel);
  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <section
          className="border-ink/10 space-y-1 border-b pb-3"
          key={skill.id}
        >
          <p className="font-medium">
            {skill.name} · {skill.passive ? '被动' : '神通'} · {skill.level}级
          </p>
          <p className="text-ink-secondary">
            {skill.methodName} ·{' '}
            {skill.available ? '已解锁' : skill.requirement}
          </p>
          <p>{skill.description}</p>
        </section>
      ))}
    </div>
  );
}
