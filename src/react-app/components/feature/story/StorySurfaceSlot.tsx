import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useStorySurface } from '@app/lib/hooks/useStorySurface';
import type {
  StorySurfaceAction,
  StorySurfaceContext,
  StorySurfaceEntry,
  StorySurfaceKey,
} from '@shared/types/story';
import { useEffect, useMemo, useState } from 'react';
import { StoryCinematicStage } from './StoryCinematicStage';

function ActionButtons({
  actions,
  busy,
  onAction,
}: {
  actions: StorySurfaceAction[];
  busy?: string;
  onAction(id: string): void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map((action) => (
        <InkButton
          key={action.id}
          variant={action.variant ?? 'secondary'}
          disabled={Boolean(busy)}
          pending={busy === action.id}
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </InkButton>
      ))}
    </div>
  );
}

function AutoEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'auto' }>;
  interact(id: string): Promise<unknown>;
}) {
  useEffect(() => {
    void interact(entry.interactionId).catch((error) =>
      console.warn('[story-surface] auto interaction failed', error),
    );
  }, [entry.interactionId, interact]);
  return null;
}

function CardEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'card' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string>();
  const act = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await interact(id);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <InkCard className="mt-5 space-y-4 border border-dashed border-current/20 p-5">
      <div>
        {entry.eyebrow ? (
          <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
        ) : null}
        <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
      </div>
      {entry.body.map((text, index) => (
        <p key={index} className="text-sm leading-7">{text}</p>
      ))}
      {entry.notice ? <InkNotice>{entry.notice}</InkNotice> : null}
      {entry.quote ? (
        <p className="border-l-2 border-current/20 pl-3 text-sm leading-7">{entry.quote}</p>
      ) : null}
      <ActionButtons actions={entry.actions} busy={busy} onAction={(id) => void act(id)} />
    </InkCard>
  );
}

function InvestigationEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'investigation' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [seen, setSeen] = useState<string[]>([]);
  const [cinematicTarget, setCinematicTarget] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const seenSet = useMemo(() => new Set(seen), [seen]);
  const ready = entry.requiredTargetIds.every((id) => seenSet.has(id));

  const inspect = (targetId: string) => {
    const target = entry.targets.find((item) => item.id === targetId);
    if (!target) return;
    if (target.cinematic && !seenSet.has(targetId)) {
      setCinematicTarget(targetId);
      return;
    }
    setSeen((current) => (current.includes(targetId) ? current : [...current, targetId]));
  };

  const act = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await interact(id);
    } finally {
      setBusy(undefined);
    }
  };

  const cinematic = entry.targets.find((item) => item.id === cinematicTarget)?.cinematic;
  return (
    <>
      <InkCard className="mt-5 space-y-5 border border-dashed border-current/20 p-5">
        <div>
          {entry.eyebrow ? (
            <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
          ) : null}
          <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
          <p className="text-ink-secondary mt-2 text-sm leading-7">{entry.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.targets.map((target) => (
            <InkButton
              key={target.id}
              variant={seenSet.has(target.id) ? 'ghost' : 'secondary'}
              onClick={() => inspect(target.id)}
            >
              {target.label}
            </InkButton>
          ))}
        </div>
        <div className="space-y-2">
          {entry.targets
            .filter((target) => seenSet.has(target.id))
            .map((target) => (
              <InkNotice key={target.id} tone={target.id === 'root' ? 'warning' : undefined}>
                {target.result}
              </InkNotice>
            ))}
        </div>
        {ready ? (
          <>
            {entry.afterRequired?.map((text, index) => (
              <p key={index} className="text-sm leading-7">{text}</p>
            ))}
            {entry.quote ? (
              <p className="border-l-2 border-current/20 pl-3 text-sm leading-7">{entry.quote}</p>
            ) : null}
            <ActionButtons actions={entry.actions} busy={busy} onAction={(id) => void act(id)} />
          </>
        ) : (
          <p className="text-ink-secondary text-sm leading-7">异常不会自动替你标红。自己看。</p>
        )}
      </InkCard>
      {cinematic ? (
        <StoryCinematicStage
          title={cinematic.title}
          visual={cinematic.visual}
          acts={cinematic.acts}
          finalLabel="回到场景"
          onFinish={() => {
            if (cinematicTarget) {
              setSeen((current) =>
                current.includes(cinematicTarget) ? current : [...current, cinematicTarget],
              );
            }
            setCinematicTarget(undefined);
          }}
          onDismiss={() => setCinematicTarget(undefined)}
        />
      ) : null}
    </>
  );
}

function CinematicEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'cinematic' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <InkCard className="mt-5 space-y-4 border border-dashed border-current/20 p-5">
        {entry.eyebrow ? (
          <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
        ) : null}
        <h3 className="text-lg font-semibold">{entry.title}</h3>
        <p className="text-sm leading-7">{entry.intro}</p>
        <InkButton variant="secondary" onClick={() => setOpen(true)}>{entry.buttonLabel}</InkButton>
      </InkCard>
      {open ? (
        <StoryCinematicStage
          title={entry.title}
          visual={entry.visual}
          acts={entry.acts}
          finalLabel={entry.finalLabel ?? '记下异象'}
          onDismiss={() => setOpen(false)}
          onFinish={() => {
            if (busy) return;
            setBusy(true);
            void interact(entry.finalInteractionId)
              .finally(() => {
                setBusy(false);
                setOpen(false);
              });
          }}
        />
      ) : null}
    </>
  );
}

function LampLedgerEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'lamp-ledger' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <InkCard className="mt-5 space-y-4 border border-dashed border-current/20 p-5">
      <div>
        <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
      </div>
      <div className="grid grid-cols-6 gap-3 py-3 sm:max-w-lg">
        {Array.from({ length: entry.lampCount }, (_, index) => (
          <button
            key={index}
            type="button"
            className="aspect-square rounded-full border border-current/20 bg-amber-50/60 text-xs"
            title="魂灯"
          >
            ◉
          </button>
        ))}
      </div>
      {ledgerOpen ? (
        <div className="max-h-52 overflow-auto border border-current/15 bg-black/[0.02] p-3 text-sm leading-7">
          {entry.ledgerNames.map((name) => <div key={name}>{name}</div>)}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <InkButton variant="secondary" onClick={() => setLedgerOpen((value) => !value)}>
          {ledgerOpen ? '合上名册' : '打开名册'}
        </InkButton>
        <InkButton
          variant="primary"
          pending={busy}
          onClick={() => {
            setBusy(true);
            void interact(entry.interactionId).finally(() => setBusy(false));
          }}
        >
          核对灯架与名册
        </InkButton>
      </div>
    </InkCard>
  );
}

function GateLedgerEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'gate-ledger' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string>();
  const act = async (id: string) => {
    setBusy(id);
    try { await interact(id); } finally { setBusy(undefined); }
  };
  return (
    <InkCard className="mt-5 space-y-4 border border-dashed border-current/20 p-5">
      <div>
        <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead><tr className="text-left text-ink-secondary"><th className="p-2">时辰</th><th className="p-2">姓名</th><th className="p-2">来处</th><th className="p-2">去处</th></tr></thead>
          <tbody>{entry.rows.map((row, index) => (
            <tr key={`${row.time}-${index}`} className="border-t border-current/10">
              <td className="p-2">{row.time}</td><td className="p-2">{row.name}</td><td className="p-2">{row.origin || ' '}</td><td className="p-2">{row.destination || ' '}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ActionButtons actions={entry.actions} busy={busy} onAction={(id) => void act(id)} />
    </InkCard>
  );
}

function MarketAppraisalEntry({
  entry,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'market-appraisal' }>;
  interact(id: string): Promise<unknown>;
}) {
  const [index, setIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const finished = index >= entry.attempts.length - 1;
  return (
    <InkCard className="mb-5 space-y-4 border border-dashed border-current/20 p-5">
      <div><p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p><h3 className="mt-1 text-lg font-semibold">{entry.title}</h3></div>
      <div className="border border-current/15 bg-black/[0.02] p-4 text-sm">待鉴物：{entry.objectName}</div>
      {index >= 0 ? (
        <div className="flex flex-wrap gap-2">
          {entry.attempts.slice(0, index + 1).map((label, itemIndex) => (
            <span key={`${label}-${itemIndex}`} className="rounded border border-current/15 px-3 py-1 text-sm line-through opacity-70">{label}</span>
          ))}
        </div>
      ) : null}
      {!finished ? (
        <InkButton variant="secondary" onClick={() => setIndex((value) => value + 1)}>
          {index < 0 ? '开始鉴定' : '换一种分类再试'}
        </InkButton>
      ) : (
        <>
          <InkNotice tone="warning">{entry.conclusion}</InkNotice>
          <p className="border-l-2 border-current/20 pl-3 text-sm leading-7">{entry.quote}</p>
          <InkButton
            variant="primary"
            pending={busy}
            onClick={() => {
              setBusy(true);
              void interact(entry.interactionId).finally(() => setBusy(false));
            }}
          >
            收回残页，带回宗门
          </InkButton>
        </>
      )}
    </InkCard>
  );
}

function DungeonDiscoveryEntry({
  entry,
  context,
  interact,
}: {
  entry: Extract<StorySurfaceEntry, { kind: 'dungeon-discovery' }>;
  context: StorySurfaceContext;
  interact(id: string, payload?: Record<string, unknown>): Promise<unknown>;
}) {
  const [lifted, setLifted] = useState(false);
  const [busy, setBusy] = useState<string>();
  if (entry.mode === 'route') {
    return (
      <InkCard className="mb-5 space-y-4 border border-dashed border-current/20 p-5">
        <div><p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p><h3 className="mt-1 text-lg font-semibold">{entry.title}</h3></div>
        <ActionButtons
          actions={entry.actions ?? []}
          busy={busy}
          onAction={(id) => {
            setBusy(id);
            void interact(id, context as Record<string, unknown>).finally(() => setBusy(undefined));
          }}
        />
      </InkCard>
    );
  }
  return (
    <InkCard className="mb-5 space-y-4 border border-dashed border-current/20 p-5">
      <div><p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p><h3 className="mt-1 text-lg font-semibold">{entry.title}</h3></div>
      {!lifted ? (
        <><p className="text-sm leading-7">{entry.intro}</p><InkButton variant="secondary" onClick={() => setLifted(true)}>翻开石块</InkButton></>
      ) : (
        <>
          <div className="mx-auto max-w-md rotate-[-0.5deg] border border-current/20 bg-paper px-6 py-8 text-center shadow-sm">
            <p className="text-ink-secondary text-xs tracking-[0.24em]">残页</p>
            <div className="mx-auto mt-4 h-20 w-3/4 border-y border-dashed border-current/15" />
            <p className="text-ink-secondary mt-4 text-xs">中央没有字，也不像被水洗掉。</p>
          </div>
          <InkNotice>你用指尖灵力划过。痕迹一跨进中央空白便被“抽走”，仿佛那一笔从来不存在。</InkNotice>
          <InkButton
            variant="primary"
            pending={busy === entry.interactionId}
            onClick={() => {
              if (!entry.interactionId) return;
              setBusy(entry.interactionId);
              void interact(entry.interactionId, context as Record<string, unknown>).finally(() => setBusy(undefined));
            }}
          >拾起残页</InkButton>
        </>
      )}
    </InkCard>
  );
}

export function StorySurfaceEntryRenderer({
  entry,
  context = {},
  interact,
}: {
  entry: StorySurfaceEntry;
  context?: StorySurfaceContext;
  interact(id: string, payload?: Record<string, unknown>): Promise<unknown>;
}) {
  if (entry.kind === 'auto') return <AutoEntry entry={entry} interact={interact} />;
  if (entry.kind === 'card') return <CardEntry entry={entry} interact={interact} />;
  if (entry.kind === 'investigation') return <InvestigationEntry entry={entry} interact={interact} />;
  if (entry.kind === 'cinematic') return <CinematicEntry entry={entry} interact={interact} />;
  if (entry.kind === 'lamp-ledger') return <LampLedgerEntry entry={entry} interact={interact} />;
  if (entry.kind === 'gate-ledger') return <GateLedgerEntry entry={entry} interact={interact} />;
  if (entry.kind === 'market-appraisal') return <MarketAppraisalEntry entry={entry} interact={interact} />;
  if (entry.kind === 'dungeon-discovery') return <DungeonDiscoveryEntry entry={entry} context={context} interact={interact} />;
  return null;
}

export function StorySurfaceSlot({
  surface,
  context = {},
  waitForExternalEvent = false,
}: {
  surface: StorySurfaceKey;
  context?: StorySurfaceContext;
  waitForExternalEvent?: boolean;
}) {
  const { entries, interact } = useStorySurface(surface, context, { waitForExternalEvent });
  const renderable = entries.filter(
    (entry) =>
      entry.kind !== 'auction-listing' &&
      entry.kind !== 'black-market-encounter' &&
      entry.kind !== 'npc-dialogue',
  );
  if (renderable.length === 0) return null;
  return (
    <>
      {renderable.map((entry) => (
        <StorySurfaceEntryRenderer key={entry.id} entry={entry} context={context} interact={interact} />
      ))}
    </>
  );
}
