import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '@shared/engine/combat-v6/content';
import {
  MERIDIAN_LEVELS,
  meridianUnlockCost,
} from '@shared/engine/combat-v6/sect-progression';
import { useCallback, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import {
  actionProblem,
  actionReference,
  type SectWorkspaceProps,
} from './actions';
import { CostText } from './CostText';

export function MeridianEditor({
  view,
  pending,
  act,
  onExit,
}: SectWorkspaceProps & { onExit: () => void }) {
  const progress = view.progress!;
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[progress.sectId];
  const [pathId, setPathId] = useState(progress.activePathId);
  const [nodes, setNodes] = useState(() => [
    ...progress.meridianLoadouts.find(
      (l) => l.pathId === progress.activePathId,
    )!.nodeIds,
  ]);
  const [leaving, setLeaving] = useState<string>();
  const [unlock, setUnlock] = useState(false);
  const path = definition.paths.find((p) => p.id === pathId)!;
  const original = progress.meridianLoadouts.find(
    (l) => l.pathId === pathId,
  )!.nodeIds;
  const dirty =
    nodes.length !== original.length ||
    nodes.some((id) => !original.includes(id));
  const blocker = useBlocker(dirty && !pending);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty],
    ),
  );
  function leave(target: string) {
    if (target === 'exit') onExit();
    else {
      setPathId(target);
      setNodes([
        ...progress.meridianLoadouts.find((l) => l.pathId === target)!.nodeIds,
      ]);
    }
    setLeaving(undefined);
  }
  const ref = actionReference(view);
  const save = { ...ref, action: 'save' as const, pathId, nodeIds: nodes };
  const activate = { ...ref, action: 'activate' as const, pathId };
  const unlockAction = { ...ref, action: 'unlock' as const };
  const locked = pending || !!view.blockedReason;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {definition.paths.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            aria-pressed={p.id === pathId}
            className={
              p.id === pathId
                ? 'font-medium underline underline-offset-4'
                : 'text-ink-secondary'
            }
            onClick={() => {
              if (p.id !== pathId) {
                if (dirty) setLeaving(p.id);
                else leave(p.id);
              }
            }}
          >
            {p.name}
            {p.id === progress.activePathId ? ' · 当前' : ''}
          </button>
        ))}
        <InkButton
          disabled={pending}
          onClick={() => {
            if (dirty) setLeaving('exit');
            else onExit();
          }}
        >
          返回
        </InkButton>
      </div>
      <div className="space-y-4">
        {MERIDIAN_LEVELS.map((level, index) => (
          <section key={index} className="space-y-2">
            <p className="text-ink-secondary">
              第 {index + 1} 层
              {index >= progress.meridianDepth
                ? ` · ${level}级解锁`
                : !nodes.some(
                      (id) =>
                        path.nodes.find((n) => n.id === id)?.layer ===
                        index + 1,
                    )
                  ? ' · 尚未选择'
                  : ''}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {path.nodes
                .filter((n) => n.layer === index + 1)
                .map((node) => (
                  <div
                    key={node.id}
                    className="border-ink/15 rounded border p-2 text-center"
                  >
                    <button
                      className={
                        nodes.includes(node.id)
                          ? 'text-crimson font-medium'
                          : 'disabled:opacity-50'
                      }
                      aria-pressed={nodes.includes(node.id)}
                      disabled={locked || node.layer > progress.meridianDepth}
                      onClick={() =>
                        setNodes(
                          nodes.includes(node.id)
                            ? nodes.filter((id) => id !== node.id)
                            : [
                                ...nodes.filter(
                                  (id) =>
                                    path.nodes.find((n) => n.id === id)!
                                      .layer !== node.layer,
                                ),
                                node.id,
                              ],
                        )
                      }
                    >
                      {node.name}
                    </button>
                    <InkTooltip label={`${node.name}说明`}>
                      {node.description}
                    </InkTooltip>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <InkButton
          pending={pending}
          disabled={!dirty || !!actionProblem(view, save)}
          onClick={() => void act(save)}
        >
          保存方案
        </InkButton>
        <InkButton
          disabled={locked || dirty || pathId === progress.activePathId}
          onClick={() => void act(activate)}
        >
          启用此流派
        </InkButton>
        {progress.meridianDepth < 7 ? (
          <InkButton disabled={locked || dirty} onClick={() => setUnlock(true)}>
            解锁下一层
          </InkButton>
        ) : null}
      </div>
      {dirty ? (
        <>
          <p className="text-ink-secondary">
            有未保存修改，保存后可启用流派。允许保留空节点。
          </p>
          {actionProblem(view, save) ? (
            <p role="alert">{actionProblem(view, save)}</p>
          ) : null}
        </>
      ) : null}
      {unlock ? (
        <InkDetailDrawer
          isOpen
          size="sm"
          title={`解锁第${progress.meridianDepth + 1}层`}
          onClose={() => {
            if (!pending) setUnlock(false);
          }}
        >
          <div className="space-y-4 text-sm">
            <p>两流派共用，只支付一次。</p>
            <CostText cost={meridianUnlockCost(progress.meridianDepth + 1)} />
            {actionProblem(view, unlockAction) ? (
              <p role="alert">{actionProblem(view, unlockAction)}</p>
            ) : null}
            <InkButton
              pending={pending}
              disabled={!!actionProblem(view, unlockAction)}
              onClick={() => void act(unlockAction)}
            >
              确认解锁
            </InkButton>
          </div>
        </InkDetailDrawer>
      ) : null}
      {leaving || blocker.state === 'blocked' ? (
        <InkDetailDrawer
          isOpen
          size="sm"
          title="有未保存的经脉修改"
          onClose={() => {
            setLeaving(undefined);
            if (blocker.state === 'blocked') blocker.reset();
          }}
        >
          <div className="space-y-4 text-sm">
            <p>可先返回保存方案，或放弃修改后离开。</p>
            <InkButton
              onClick={() => {
                setLeaving(undefined);
                if (blocker.state === 'blocked') blocker.reset();
              }}
            >
              返回保存
            </InkButton>
            <InkButton
              onClick={() => {
                if (blocker.state === 'blocked') blocker.proceed();
                else if (leaving) leave(leaving);
              }}
            >
              放弃修改
            </InkButton>
          </div>
        </InkDetailDrawer>
      ) : null}
    </div>
  );
}
