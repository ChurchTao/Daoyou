import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  COMBAT_V6_SECT_DEFINITIONS,
  type MeridianNodeDefV6,
} from '@shared/engine/combat-v6/content';
import {
  MERIDIAN_LEVELS,
  meridianUnlockCost,
} from '@shared/engine/combat-v6/sect-progression';
import { SECT_PANEL_LABELS } from '@shared/engine/combat-v6/sect-progression/presentation';
import { useState, useSyncExternalStore } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import {
  actionProblem,
  actionReference,
  type SectWorkspaceProps,
} from './actions';
import { CostText } from './CostText';

const compactQuery = '(max-width: 767px)';
function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const readCompact = () => window.matchMedia(compactQuery).matches;
const readServerCompact = () => false;
const layerNames = ['一', '二', '三', '四', '五', '六', '七'];

export function MeridianEditor({
  view,
  pending,
  act,
  onExit,
}: SectWorkspaceProps & { onExit: () => void }) {
  const progress = view.progress!;
  const definition = COMBAT_V6_SECT_DEFINITIONS[progress.sectId];
  const [pathId, setPathId] = useState(progress.activePathId);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [focusedId, setFocusedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [leaving, setLeaving] = useState<string>();
  const [unlock, setUnlock] = useState(false);
  const compact = useSyncExternalStore(
    subscribeCompact,
    readCompact,
    readServerCompact,
  );
  const path = definition.paths.find((entry) => entry.id === pathId)!;
  const original = progress.meridianLoadouts.find(
    (entry) => entry.pathId === pathId,
  )!.nodeIds;
  const nodes = draft ?? original;
  const dirty =
    nodes.length !== original.length ||
    nodes.some((id) => !original.includes(id));
  const focused =
    path.nodes.find((node) => node.id === focusedId) ??
    path.nodes.find((node) => original.includes(node.id)) ??
    path.nodes[0];
  const selectedByLayer = MERIDIAN_LEVELS.map((_, index) =>
    path.nodes.find(
      (node) => node.layer === index + 1 && nodes.includes(node.id),
    ),
  );
  const skillNames = new Map(
    [
      ...definition.skills,
      ...(path.grantSkills ?? []),
      ...(path.foundationPassives ?? []),
      ...path.nodes.flatMap((node) => [
        ...(node.grantSkills ?? []),
        ...(node.passives ?? []),
      ]),
    ].map((skill) => [skill.definition.id, skill.definition.name]),
  );
  const blocker = useBlocker(dirty && !pending);
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  function leave(target: string) {
    if (target === 'exit') onExit();
    else {
      setPathId(target);
      setDraft(null);
      setFocusedId(undefined);
      setDetailOpen(false);
    }
    setLeaving(undefined);
  }
  const ref = actionReference(view);
  const save = { ...ref, action: 'save' as const, pathId, nodeIds: [...nodes] };
  const activate = { ...ref, action: 'activate' as const, pathId };
  const unlockAction = { ...ref, action: 'unlock' as const };
  const locked = pending || !!view.blockedReason;
  const saveProblem = dirty ? actionProblem(view, save) : null;
  const unlockProblem =
    progress.meridianDepth < 7 ? actionProblem(view, unlockAction) : null;
  function chooseNode() {
    setDraft(
      nodes.includes(focused.id)
        ? nodes.filter((id) => id !== focused.id)
        : [
            ...nodes.filter(
              (id) =>
                path.nodes.find((node) => node.id === id)!.layer !==
                focused.layer,
            ),
            focused.id,
          ],
    );
    setDetailOpen(false);
  }
  const details = (
    <NodeDetails
      node={focused}
      selected={nodes.includes(focused.id)}
      depth={progress.meridianDepth}
      pathName={path.name}
      skillNames={skillNames}
      locked={locked}
      onChoose={chooseNode}
      showTitle={!compact}
    />
  );
  return (
    <div>
      <header className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-4" aria-label="流派">
          {definition.paths.map((entry) => (
            <button
              type="button"
              key={entry.id}
              disabled={pending}
              aria-pressed={entry.id === pathId}
              className="text-ink-secondary hover:text-ink aria-pressed:border-crimson/60 aria-pressed:text-crimson focus-visible:outline-crimson/60 min-h-11 cursor-pointer border-b-2 border-transparent px-1 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
              onClick={() => {
                if (entry.id !== pathId) {
                  if (dirty) setLeaving(entry.id);
                  else leave(entry.id);
                }
              }}
            >
              {entry.name}
              {entry.id === progress.activePathId ? (
                <small className="text-crimson/80 ml-1.5 text-xs">当前</small>
              ) : null}
            </button>
          ))}
        </div>
        <InkButton
          disabled={pending}
          onClick={() => {
            if (dirty) setLeaving('exit');
            else onExit();
          }}
        >
          返回
        </InkButton>
      </header>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-6">
        <div>
          <div className="relative my-4">
            <svg
              className="text-crimson/35 pointer-events-none absolute top-0 -left-1 h-112 w-[calc(100%+0.5rem)] [&_line]:stroke-current [&_line]:stroke-1"
              viewBox="0 0 300 448"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {selectedByLayer.slice(0, -1).map((node, index) => {
                const next = selectedByLayer[index + 1];
                return node && next ? (
                  <line
                    key={node.id}
                    x1={(node.slot - 0.5) * 100}
                    y1={(index + 0.5) * 64}
                    x2={(next.slot - 0.5) * 100}
                    y2={(index + 1.5) * 64}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null;
              })}
            </svg>
            {MERIDIAN_LEVELS.map((_, index) => (
              <div key={index} className="flex h-16 items-center">
                <div className="grid w-full grid-cols-3 items-center gap-2">
                  {path.nodes
                    .filter((node) => node.layer === index + 1)
                    .sort((a, b) => a.slot - b.slot)
                    .map((node) => {
                      const selected = nodes.includes(node.id);
                      const changed = selected !== original.includes(node.id);
                      return (
                        <button
                          type="button"
                          key={node.id}
                          className={[
                            'border-ink/15 bg-paper hover:border-ink/35 hover:bg-paper-dark focus-visible:outline-crimson/60 relative z-1 min-h-11 cursor-pointer border px-1 py-2 text-center text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                            selected
                              ? 'data-[selected=true]:border-crimson/50 data-[selected=true]:bg-paper-2 data-[selected=true]:text-crimson'
                              : '',
                            focused.id === node.id ? 'ring-ink/15 ring-2' : '',
                            node.layer > progress.meridianDepth
                              ? 'text-ink-secondary border-dashed'
                              : '',
                          ].join(' ')}
                          data-selected={selected}
                          aria-label={`第${node.layer}层 ${node.name}${selected ? ' 已选择' : ''}${node.layer > progress.meridianDepth ? ' 未解锁' : ''}${changed ? ' 待保存' : ''}`}
                          onClick={() => {
                            setFocusedId(node.id);
                            setDetailOpen(true);
                          }}
                        >
                          {node.name}
                          {selected ? <span aria-hidden="true"> ·</span> : null}
                          {changed ? (
                            <span className="bg-paper text-crimson absolute -top-2 right-1 px-1 text-[10px]">
                              待保存
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          {progress.meridianDepth < 7 ? (
            <div className="text-ink-secondary flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                下一层 · 人物{MERIDIAN_LEVELS[Number(progress.meridianDepth)]}级
              </span>
              <InkButton
                disabled={locked || dirty}
                onClick={() => setUnlock(true)}
              >
                解锁第{progress.meridianDepth + 1}层
              </InkButton>
            </div>
          ) : null}
        </div>
        {!compact ? (
          <aside className="md:border-ink/10 min-w-0 pt-6 md:border-l md:pl-6 [&_h3]:text-base [&_h3]:font-medium">
            {details}
          </aside>
        ) : null}
      </div>
      <footer className="border-ink/10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p
          className={
            saveProblem
              ? 'text-crimson'
              : 'text-ink-secondary text-xs leading-relaxed'
          }
          role="status"
        >
          {saveProblem ??
            (dirty
              ? '有未保存修改'
              : nodes.length < progress.meridianDepth
                ? '已解锁层仍有空位，可继续选择节点。'
                : '方案已保存')}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          {dirty ? (
            <>
              <InkButton
                type="button"
                variant="secondary"
                className="focus-visible:outline-crimson/60 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                disabled={pending}
                onClick={() => setDraft(null)}
              >
                放弃修改
              </InkButton>
              <InkButton
                type="button"
                variant="primary"
                className="focus-visible:outline-crimson/60 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                disabled={locked || !!saveProblem}
                pending={pending}
                pendingLabel="保存中……"
                onClick={async () => {
                  if (await act(save)) setDraft(null);
                }}
              >
                保存方案
              </InkButton>
            </>
          ) : pathId !== progress.activePathId ? (
            <InkButton
              type="button"
              variant="primary"
              className="focus-visible:outline-crimson/60 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              disabled={locked}
              pending={pending}
              pendingLabel="启用中……"
              onClick={() => void act(activate)}
            >
              启用此流派
            </InkButton>
          ) : null}
        </div>
      </footer>
      <InkDetailDrawer
        isOpen={compact && detailOpen && !leaving && !unlock}
        size="sm"
        title={focused.name}
        onClose={() => setDetailOpen(false)}
      >
        <div className="text-sm">{details}</div>
      </InkDetailDrawer>
      <InkDetailDrawer
        isOpen={unlock}
        size="sm"
        title={`解锁第${progress.meridianDepth + 1}层`}
        onClose={() => {
          if (!pending) setUnlock(false);
        }}
      >
        {progress.meridianDepth < 7 ? (
          <div className="space-y-4 text-sm">
            <p>两流派共用，只支付一次。</p>
            <CostText cost={meridianUnlockCost(progress.meridianDepth + 1)} />
            {unlockProblem ? <p role="alert">{unlockProblem}</p> : null}
            <InkButton
              pending={pending}
              disabled={!!unlockProblem}
              onClick={async () => {
                if (await act(unlockAction)) setUnlock(false);
              }}
            >
              确认解锁
            </InkButton>
          </div>
        ) : null}
      </InkDetailDrawer>
      <InkDetailDrawer
        isOpen={!!leaving || blocker.state === 'blocked'}
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
    </div>
  );
}

function NodeDetails({
  node,
  selected,
  depth,
  pathName,
  skillNames,
  locked,
  onChoose,
  showTitle,
}: {
  node: MeridianNodeDefV6;
  selected: boolean;
  depth: number;
  pathName: string;
  skillNames: Map<string, string>;
  locked: boolean;
  onChoose: () => void;
  showTitle: boolean;
}) {
  const affected = [
    ...new Set([
      ...(node.patches ?? [])
        .map((patch) => skillNames.get(patch.skillId))
        .filter((name): name is string => !!name),
      ...(node.grantSkills ?? []).map((skill) => skill.definition.name),
      ...(node.revokeSkillIds ?? [])
        .map((id) => skillNames.get(id))
        .filter((name): name is string => !!name),
    ]),
  ];
  const unavailable = node.layer > depth;
  return (
    <>
      <p className="text-ink-secondary mb-3 text-xs">
        {pathName} · 第{layerNames[node.layer - 1]}层
      </p>
      {showTitle ? <h3>{node.name}</h3> : null}
      <p className="text-ink-secondary mt-3 mb-5 leading-7">
        {node.description}
      </p>
      <div className="border-ink/10 mb-5 space-y-2 border-t pt-4">
        {unavailable ? (
          <>
            <p className="text-ink-secondary text-xs leading-relaxed">
              解锁条件
            </p>
            <p>人物达到{MERIDIAN_LEVELS[node.layer - 1]}级，逐层解锁。</p>
          </>
        ) : (
          <>
            {affected.length ? (
              <>
                <p className="text-ink-secondary text-xs leading-relaxed">
                  关联神通
                </p>
                <p>{affected.join('、')}</p>
              </>
            ) : null}
            {node.panel?.map((panel, index) => (
              <p key={index}>
                {SECT_PANEL_LABELS[panel.attr] ?? panel.attr}{' '}
                {panel.value >= 0 ? '+' : ''}
                {panel.value}
              </p>
            ))}
            <p className="text-ink-secondary text-xs leading-relaxed">
              {selected ? '当前方案已选择此节点。' : '选择后替换本层原节点。'}
            </p>
          </>
        )}
      </div>
      <InkButton
        type="button"
        variant={selected ? 'secondary' : 'primary'}
        className="focus-visible:outline-crimson/60 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        disabled={locked || unavailable}
        onClick={onChoose}
      >
        {unavailable ? '尚未解锁' : selected ? '取消选择' : '选择此节点'}
      </InkButton>
    </>
  );
}
