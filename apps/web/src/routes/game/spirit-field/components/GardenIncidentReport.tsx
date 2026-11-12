import { InkModal } from '@app/components/layout/InkModal';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import {
  SPIRIT_GARDEN_BEAST_RECOVERY_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
} from '@daoyou/game-content/spirit-field/config';
import type {
  SpiritGardenIncident,
  SpiritGardenPlantView,
} from '@daoyou/game-domain/spirit-field';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatGardenDuration, gardenSeedName } from '../garden-presentation';
import { GARDEN_INCIDENT_ART } from './gardenIncidentArt';

interface GardenIncidentReportProps {
  snapshot: SpiritFieldSnapshot;
  cultivatorId: string;
  locked: boolean;
  onSelectPlot(index: number): void;
  onOpenCollection(): void;
}

interface ReportEntry {
  key: string;
  plant: SpiritGardenPlantView;
  incident: SpiritGardenIncident;
  plotIndex: number | null;
}

const incidentTitles = {
  pests: '虫害',
  beast: '灵兽偷吃',
  mutation: '生长加速',
} satisfies Record<SpiritGardenIncident['kind'], string>;

const incidentDate = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function readSeen(storageKey: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value)
      ? value
          .filter((key): key is string => typeof key === 'string')
          .slice(-160)
      : [];
  } catch {
    return [];
  }
}

function IncidentStatus({ entry }: { entry: ReportEntry }) {
  const { plant, incident, plotIndex } = entry;
  if (plant.exhausted)
    return (
      <p className="text-ink-secondary text-sm leading-7">
        这株灵植已停止产出，异事已结束。
      </p>
    );
  if (incident.kind === 'mutation')
    return (
      <p className="text-teal text-sm leading-7">
        生产速度提高 <span className="font-mono">10%</span>。
        {plotIndex === null
          ? '移回灵田后继续生产。'
          : plant.storageFull
            ? '收成已满，领取后继续生产。'
            : '无需照料。'}
      </p>
    );
  const recovering =
    plant.incidents.filter((entry) => entry.kind !== 'mutation').at(-1) ===
      incident && plant.recoveryRemainingMs > 0;
  if (recovering)
    return (
      <p className="text-ink-secondary text-sm leading-7">
        {plotIndex === null
          ? '已暂存，恢复计时暂停；尚需约 '
          : plant.storageFull
            ? '收成已满，恢复计时暂停；领取后还需约 '
            : '暂停生产，恢复还需约 '}
        <span className="font-mono">
          {formatGardenDuration(plant.recoveryRemainingMs)}
        </span>
        。无需照料。不会扣除已有收成。
        {plotIndex === null || plant.storageFull
          ? '计时暂停期间不消耗寿命。'
          : '恢复期间仍消耗生产寿命。'}
      </p>
    );
  return (
    <p className="text-ink-secondary text-sm leading-7">
      曾需要恢复{' '}
      <span className="font-mono">
        {formatGardenDuration(
          incident.kind === 'pests'
            ? SPIRIT_GARDEN_PEST_RECOVERY_MS
            : SPIRIT_GARDEN_BEAST_RECOVERY_MS,
        )}
      </span>
      ，现已恢复。
    </p>
  );
}

const logDate = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});
const entryKey = (entry: Pick<ReportEntry, 'plant' | 'incident'>) =>
  [entry.plant.id, entry.incident.productionDay, entry.incident.kind].join(':');

/** InkModal owns the surface; this local body owns focus and its accessible name. */
function IncidentModalBody({
  titleId,
  children,
}: {
  titleId: string;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = bodyRef.current;
    const dialog = body?.closest<HTMLElement>('[role="dialog"]');
    if (!body || !dialog) return;
    dialog.setAttribute('aria-labelledby', titleId);
    body.focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        body.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === body)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, [titleId]);
  return (
    <div ref={bodyRef} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}

/** Logs stay visible after reading; only a deliberately opened event shows artwork. */
export function GardenIncidentReport(props: GardenIncidentReportProps) {
  return <CultivatorIncidentReport key={props.cultivatorId} {...props} />;
}

function CultivatorIncidentReport({
  snapshot,
  cultivatorId,
  locked,
  onSelectPlot,
  onOpenCollection,
}: GardenIncidentReportProps) {
  const storageKey = 'daoyou:spirit-garden:incidents-seen:v1:' + cultivatorId;
  const [seen, setSeen] = useState(() => readSeen(storageKey));
  const [view, setView] = useState<{ key: string } | 'all' | null>(null);
  const titleId = useId();
  const journalRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const allTriggerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setSeen(readSeen(storageKey));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  const plants = [
    ...snapshot.plots.flatMap((plot) =>
      plot.plant ? [{ plant: plot.plant, plotIndex: plot.index }] : [],
    ),
    ...snapshot.collection.map((plant) => ({ plant, plotIndex: null })),
  ];
  const entries: ReportEntry[] = plants
    .flatMap(({ plant, plotIndex }) =>
      plant.incidents.map((incident) => ({
        key: entryKey({ plant, incident }),
        plant,
        incident,
        plotIndex,
      })),
    )
    .sort(
      (a, b) =>
        b.incident.occurredAt - a.incident.occurredAt ||
        a.key.localeCompare(b.key),
    );
  const selected =
    view && view !== 'all'
      ? entries.find((entry) => entry.key === view.key)
      : null;
  const unread = entries.filter((entry) => !seen.includes(entry.key)).length;

  function markSeen(key: string) {
    const current = new Set(entries.map((entry) => entry.key));
    const next = [...new Set([...readSeen(storageKey), ...seen, key])].filter(
      (value) => current.has(value),
    );
    setSeen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep this visit readable when storage is unavailable. */
    }
  }
  function openEntry(entry: ReportEntry, trigger?: HTMLElement) {
    if (trigger) triggerRef.current = trigger;
    markSeen(entry.key);
    setView({ key: entry.key });
  }
  function close() {
    setView(null);
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else
      journalRef.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus({ preventScroll: true });
  }
  function inspectPlant(entry: ReportEntry) {
    setView(null);
    window.setTimeout(() => {
      if (entry.plotIndex === null) onOpenCollection();
      else onSelectPlot(entry.plotIndex);
    }, 0);
  }
  function renderLog(entry: ReportEntry, compact: boolean) {
    const fresh = !seen.includes(entry.key);
    return (
      <li key={entry.key}>
        <button
          type="button"
          disabled={locked}
          aria-haspopup="dialog"
          aria-label={
            incidentDate.format(entry.incident.occurredAt) +
            '，' +
            entry.plant.speciesName +
            '，' +
            incidentTitles[entry.incident.kind] +
            (fresh ? '，未读' : '，已读') +
            '，查看详情'
          }
          onClick={(event) =>
            openEntry(entry, view === null ? event.currentTarget : undefined)
          }
          className="text-ink hover:text-crimson flex min-h-8 w-full cursor-pointer items-baseline gap-2 py-1 text-left text-xs leading-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <time
            dateTime={new Date(entry.incident.occurredAt).toISOString()}
            className="text-ink-secondary shrink-0 font-mono"
          >
            {compact
              ? logDate.format(entry.incident.occurredAt)
              : incidentDate.format(entry.incident.occurredAt)}
          </time>
          <span className="min-w-0 flex-1 truncate">
            {incidentTitles[entry.incident.kind]} · {entry.plant.speciesName}
          </span>
          {fresh ? <span className="text-crimson shrink-0">新</span> : null}
        </button>
      </li>
    );
  }

  if (!entries.length) return null;
  const seedPending =
    selected?.incident.seedSpeciesId != null &&
    selected.plant.pendingSeedSpeciesId === selected.incident.seedSpeciesId;
  return (
    <section
      ref={journalRef}
      aria-label="灵田近况"
      className="garden-notebook-incidents"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <h3>灵田近况</h3>
        {unread > 0 ? (
          <span className="text-crimson text-xs">
            <span className="font-mono">{unread}</span> 条未读
          </span>
        ) : null}
      </div>
      <ol>{entries.slice(0, 3).map((entry) => renderLog(entry, true))}</ol>
      {entries.length > 3 ? (
        <div ref={allTriggerRef} className="mt-2">
          <InkButton
            variant="secondary"
            disabled={locked}
            onClick={() => {
              triggerRef.current =
                allTriggerRef.current?.querySelector('button') ?? null;
              setView('all');
            }}
          >
            查看全部近况
          </InkButton>
        </div>
      ) : null}
      <InkModal
        isOpen={view !== null}
        onClose={close}
        title={
          <span id={titleId}>
            {selected ? incidentTitles[selected.incident.kind] : '灵田近况'}
          </span>
        }
        className="spirit-garden garden-panel"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {selected && entries.length > 1 ? (
                <InkButton variant="secondary" onClick={() => setView('all')}>
                  全部近况
                </InkButton>
              ) : null}
              {selected ? (
                <InkButton
                  disabled={locked}
                  onClick={() => inspectPlant(selected)}
                >
                  {selected.plotIndex === null
                    ? '查看暂存灵植'
                    : '查看这株灵植'}
                </InkButton>
              ) : null}
            </div>
            <InkButton variant="secondary" onClick={close}>
              关闭
            </InkButton>
          </div>
        }
      >
        {view !== null ? (
          <IncidentModalBody
            key={view === 'all' ? 'all' : view.key}
            titleId={titleId}
          >
            {view === 'all' ? (
              <ol className="divide-ink/10 divide-y">
                {entries.map((entry) => renderLog(entry, false))}
              </ol>
            ) : selected ? (
              <div className="space-y-4 text-sm leading-7">
                <GameImage
                  src={GARDEN_INCIDENT_ART[selected.incident.kind]}
                  alt=""
                  width={192}
                  height={192}
                  className="mx-auto size-40 object-contain sm:size-48"
                />
                <div className="space-y-1 text-center">
                  <p>
                    {selected.plotIndex === null ? (
                      '暂存区'
                    ) : (
                      <>
                        <span className="font-mono">
                          {selected.plotIndex + 1}
                        </span>
                        号田
                      </>
                    )}{' '}
                    · {selected.plant.speciesName}
                  </p>
                  <time
                    dateTime={new Date(
                      selected.incident.occurredAt,
                    ).toISOString()}
                    className="text-ink-secondary font-mono text-xs"
                  >
                    {incidentDate.format(selected.incident.occurredAt)}
                  </time>
                </div>
                <IncidentStatus entry={selected} />
                {selected.incident.seedSpeciesId ? (
                  <p className="text-teal text-xs leading-6">
                    {seedPending ? '灵兽留下了 ' : '灵兽曾留下 '}
                    {gardenSeedName(
                      selected.incident.seedSpeciesId,
                      snapshot.species,
                    )}{' '}
                    <span className="font-mono">1</span> 枚
                    {seedPending ? '，尚待领取。' : '。'}
                  </p>
                ) : null}
              </div>
            ) : (
              <InkNotice>
                这条近况对应的灵植已移出灵田，请关闭后重新查看。
              </InkNotice>
            )}
          </IncidentModalBody>
        ) : null}
      </InkModal>
    </section>
  );
}
