import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  SectV6Action,
  SectV6Cost,
  SectV6View,
} from '@shared/contracts/combatV6Sect';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '@shared/engine/combat-v6/content';
import { sectV6Change } from '@shared/engine/combat-v6/sect-progression';
import {
  SECT_PANEL_LABELS,
  sectSkillCatalog,
} from '@shared/engine/combat-v6/sect-progression/presentation';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import {
  actionProblem,
  actionReference,
  type SectWorkspaceProps,
} from './actions';
import { CostText } from './CostText';
import { MeridianEditor } from './MeridianEditor';

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
  const [notice, setNotice] = useState('');
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
    setNotice('');
    reader.current?.abort();
    try {
      await consumeResourceMutation(
        await fetch(url, {
          ...mutationBody(input),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (alive.current) {
        setNotice('传承已更新，下一场战斗生效。');
        setView(undefined);
        setRefresh((n) => n + 1);
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
    <div className="min-h-[24rem] space-y-4 px-5 py-7 text-sm sm:px-8">
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
      {notice ? <p role="status">{notice}</p> : null}
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
              key={`${view.build.membershipId}:${view.build.revision}`}
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
                <Methods
                  key={`${view.build.membershipId}:${view.build.revision}`}
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

function Skills({ view, methodId }: { view: SectV6View; methodId?: string }) {
  const skills = sectSkillCatalog(view.progress!, view.characterLevel).filter(
    (skill) => !methodId || skill.methodId === methodId,
  );
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

function Methods({ view, pending, act }: SectWorkspaceProps) {
  const [selected, setSelected] = useState('');
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[view.progress!.sectId];
  const method = definition.methods.find((m) => m.id === selected);
  const level = method ? view.progress!.methods[method.id] : 0;
  const action: SectV6Action = {
    ...actionReference(view),
    action: 'train',
    methodId: selected,
  };
  let cost: SectV6Cost | undefined;
  if (method) {
    try {
      cost = sectV6Change(view.progress!, view.characterLevel, action).cost;
    } catch {
      /* Validation message below. */
    }
  }
  const problem = method ? actionProblem(view, action) : null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {definition.methods.map((m) => (
          <button
            className="border-ink/15 hover:bg-ink/5 rounded border p-4 text-left"
            disabled={pending}
            key={m.id}
            onClick={() => setSelected(m.id)}
          >
            <span className="block">
              {m.name}
              {m.isPrimary ? ' · 主心法' : ''}
            </span>
            <span className="text-ink-secondary">
              {view.progress!.methods[m.id]}级
            </span>
          </button>
        ))}
      </div>
      {method ? (
        <InkDetailDrawer
          isOpen
          size="sm"
          title={method.name}
          onClose={() => {
            if (!pending) setSelected('');
          }}
        >
          <div className="space-y-4 text-sm">
            <p>
              当前 {level} 级 · 上限 {Math.min(180, view.characterLevel + 10)}{' '}
              级
            </p>
            {method.panel ? (
              <p>
                {SECT_PANEL_LABELS[method.panel.attr] ?? method.panel.attr}：
                {Math.floor(method.panel.value * level)}
                {level < 180
                  ? ` → ${Math.floor(method.panel.value * (level + 1))}`
                  : ''}
              </p>
            ) : null}
            <Skills view={view} methodId={method.id} />
            {cost ? <CostText cost={cost} /> : null}
            {problem ? (
              <p role="alert" className="text-crimson">
                {problem}
              </p>
            ) : null}
            <InkButton
              pending={pending}
              disabled={!!problem}
              onClick={() => void act(action)}
            >
              升一级
            </InkButton>
          </div>
        </InkDetailDrawer>
      ) : null}
    </>
  );
}
