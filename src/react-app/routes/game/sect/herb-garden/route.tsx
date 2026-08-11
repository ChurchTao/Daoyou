import { useHerbGarden } from '@app/components/feature/sect/herbGardenResources';
import { GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import {
  InkDialog,
  type InkDialogState,
} from '@app/components/ui/InkDialog';
import type {
  HerbGardenPlotView,
  HerbGardenSeedStack,
} from '@shared/contracts/herbGarden';
import { useEffect, useState } from 'react';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';

const PLOT_DETAIL_LABELS = [
  '第一畦',
  '第二畦',
  '第三畦',
  '第四畦',
  '第五畦',
  '第六畦',
];

export default function SectHerbGardenPage() {
  return (
    <SectPermissionBoundary
      permission="sect.herb_garden.view"
      sceneKey="herbGarden"
    >
      <SectHerbGardenScene />
    </SectPermissionBoundary>
  );
}

function SectHerbGardenScene() {
  const { pushToast } = useInkUI();
  const [visitOwnerId, setVisitOwnerId] = useState<string>();
  const garden = useHerbGarden(visitOwnerId);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (garden.loading && !garden.data) {
    return (
      <SectScene sceneKey="herbGarden" mood="garden">
        <GameSceneLoading message="执事正在翻开今日草木值录……" />
      </SectScene>
    );
  }

  if (!garden.data) {
    return (
      <SectScene sceneKey="herbGarden" mood="garden">
        <GameSceneNote tone="danger">
          {garden.error ?? '灵药圃暂时无法读取。'}
        </GameSceneNote>
        <InkButton onClick={() => void garden.retry()}>重新读取</InkButton>
      </SectScene>
    );
  }

  const state = garden.data;
  const isSelf = state.owner.isSelf;
  const growingCount = Math.max(0, state.summary.planted - state.summary.ready);
  const emptyCount = Math.max(0, state.plots.length - state.summary.planted);
  const recentLogs = state.logs.slice(0, 4);
  const activeFriends = [...state.friends]
    .sort((a, b) => b.readyPlots - a.readyPlots || b.growingPlots - a.growingPlots)
    .slice(0, 4);

  const showSeedPicker = (slot: number) => {
    const available = state.seeds.filter(
      (seed) => seed.quantity > 0 && seed.minGardenLevel <= state.gardenLevel,
    );
    setDialog({
      id: `seed-${slot}`,
      title: '【选择灵种】',
      confirmLabel: null,
      cancelLabel: '返回药田',
      content: (
        <div className="space-y-3">
          <p className="text-ink-secondary text-xs leading-6">
            {PLOT_DETAIL_LABELS[slot - 1]} · 灵种取自储物袋，播种后消耗一枚对应灵种。
          </p>
          {available.length === 0 ? (
            <p className="text-ink-secondary text-sm leading-7">
              储物袋中暂没有适合当前药圃的灵种。收获时有机会留下种子，后续玩法奖励也可获得新的灵种。
            </p>
          ) : (
            <div className="space-y-2">
              {available.map((seed) => (
                <SeedChoice
                  key={seed.materialId}
                  seed={seed}
                  disabled={garden.busy}
                  onPlant={async () => {
                    try {
                      await garden.plant(slot, seed.materialId);
                      pushToast({
                        message: `${seed.herbName}已入土，静候草木生发。`,
                        tone: 'success',
                      });
                      setDialog(null);
                    } catch {
                      // 服务端原因会留在页面错误区。
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ),
    });
  };

  const showPlotDetails = (plot: HerbGardenPlotView) => {
    if (plot.status === 'empty') {
      if (isSelf) showSeedPicker(plot.slot);
      return;
    }
    setDialog({
      id: plot.plotId ?? `plot-${plot.slot}`,
      title: `【${plot.herbName ?? '灵植'}】`,
      confirmLabel: null,
      cancelLabel: '返回药田',
      content: <PlotDetail plot={plot} now={now} isSelf={isSelf} />,
    });
  };

  const interactWithPlot = async (plot: HerbGardenPlotView) => {
    if (garden.busy) return;
    if (plot.status === 'empty') {
      if (isSelf) showSeedPicker(plot.slot);
      return;
    }
    if (!plot.plotId) {
      showPlotDetails(plot);
      return;
    }

    try {
      if (isSelf && plot.status === 'ready') {
        const result = await garden.harvest(plot.plotId);
        if (result.result.mutation) {
          pushToast({
            message: `灵机乍现！收下「${result.result.herbName} ×${result.result.quantity}」，并得「${result.result.mutation.name} ×1」。`,
            tone: 'success',
          });
        } else {
          pushToast({
            message: `收下「${result.result.herbName} ×${result.result.quantity}」。`,
            tone: 'success',
          });
        }
        return;
      }

      if (!isSelf && plot.status === 'ready' && plot.canSteal) {
        const result = await garden.steal(state.owner.cultivatorId, plot.plotId);
        pushToast({
          message: `你趁药香正盛，采得「${result.result.herbName} ×1」。`,
          tone: 'success',
        });
        return;
      }

      if (!isSelf && plot.status === 'growing' && plot.canHelp) {
        await garden.help(state.owner.cultivatorId, plot.plotId);
        pushToast({
          message: '你替道友引来一缕灵气，草木愈发精神。',
          tone: 'success',
        });
        return;
      }
    } catch {
      return;
    }

    showPlotDetails(plot);
  };

  const harvestAll = async () => {
    try {
      const result = await garden.harvestAll();
      if (result.results.length === 0) return;
      const mutationCount = result.results.filter((item) => item.mutation).length;
      pushToast({
        message:
          mutationCount > 0
            ? `成熟灵药已尽数收妥，其中 ${mutationCount} 畦显出灵变。`
            : '成熟灵药已尽数收妥。',
        tone: 'success',
      });
    } catch {
      // 服务端原因会留在页面错误区。
    }
  };

  return (
    <SectScene sceneKey="herbGarden" mood="garden">
      <div className="space-y-4">
        {!isSelf ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
            <div>
              <p className="text-ink-secondary text-xs tracking-[0.18em]">
                访友药田
              </p>
              <p className="mt-1 text-sm">
                正在拜访 <strong>{state.owner.name}</strong> 的灵药圃
              </p>
            </div>
            <InkButton onClick={() => setVisitOwnerId(undefined)}>
              返回我的药田
            </InkButton>
          </div>
        ) : null}

        {garden.error ? (
          <GameSceneNote tone="danger">{garden.error}</GameSceneNote>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="relative overflow-hidden border border-current/10 bg-bgpaper/15 p-3 sm:p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-current/10 pb-3">
              <div>
                <p className="text-sm font-medium tracking-[0.12em]">
                  {state.owner.name}的灵药圃
                </p>
                <p className="text-ink-secondary mt-1 text-xs">
                  宗门药圃 Lv.{state.gardenLevel} · 草木灵气充盈
                </p>
              </div>
              {isSelf && state.summary.ready > 0 ? (
                <button
                  type="button"
                  disabled={garden.busy}
                  onClick={() => void harvestAll()}
                  className="text-crimson disabled:text-ink-secondary text-xs tracking-[0.12em] hover:underline"
                >
                  收取全部成熟灵药
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {state.plots.map((plot) => (
                <HerbPlot
                  key={plot.slot}
                  plot={plot}
                  now={now}
                  isSelf={isSelf}
                  busy={garden.busy}
                  onClick={() => void interactWithPlot(plot)}
                />
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <InkCard className="mb-0" padding="md">
              <PanelTitle title="药圃近况" meta={isSelf ? '我的灵圃' : '访友'} />
              <div className="grid grid-cols-3 divide-x divide-current/10 text-center">
                <Metric value={String(growingCount)} label="生长" />
                <Metric value={String(state.summary.ready)} label="成熟" emphasize />
                <Metric value={String(emptyCount)} label="空地" />
              </div>
              {isSelf && state.summary.ready > 0 ? (
                <div className="mt-4 border-t border-current/10 pt-3">
                  <InkButton
                    variant="primary"
                    disabled={garden.busy}
                    onClick={() => void harvestAll()}
                  >
                    收取全部
                  </InkButton>
                </div>
              ) : null}
            </InkCard>

            {isSelf ? (
              <InkCard className="mb-0" padding="md">
                <PanelTitle title="道友往来" meta="可回访" />
                <div className="space-y-3">
                  {recentLogs.length === 0 && activeFriends.length === 0 ? (
                    <p className="text-ink-secondary text-xs leading-6">
                      今日田间清静。结识道友后，可互访药田、替彼此聚灵，也可趁灵药成熟时采上一株。
                    </p>
                  ) : null}

                  {recentLogs.map((log) => {
                    const canRevisit = state.friends.some(
                      (friend) => friend.cultivatorId === log.actorId,
                    );
                    return (
                      <div
                        key={log.id}
                        className="border-b border-dashed border-current/10 pb-2 text-xs leading-5"
                      >
                        <p>{log.message}</p>
                        {canRevisit ? (
                          <button
                            type="button"
                            className="text-crimson mt-1 hover:underline"
                            onClick={() => setVisitOwnerId(log.actorId)}
                          >
                            回访
                          </button>
                        ) : null}
                      </div>
                    );
                  })}

                  {activeFriends.map((friend) => (
                    <button
                      key={friend.cultivatorId}
                      type="button"
                      className="hover:bg-ink/5 flex w-full items-center justify-between gap-3 border-b border-dashed border-current/10 py-1.5 text-left text-xs last:border-0"
                      onClick={() => setVisitOwnerId(friend.cultivatorId)}
                    >
                      <span>
                        {friend.name}
                        <span className="text-ink-secondary ml-1">· {friend.realm}</span>
                      </span>
                      <span
                        className={
                          friend.readyPlots > 0
                            ? 'text-crimson'
                            : 'text-ink-secondary'
                        }
                      >
                        {friend.readyPlots > 0
                          ? `${friend.readyPlots}处可采`
                          : friend.growingPlots > 0
                            ? '草木生发'
                            : '田间清静'}
                      </span>
                    </button>
                  ))}
                </div>
              </InkCard>
            ) : (
              <InkCard className="mb-0" padding="md">
                <PanelTitle title="访友小记" meta="轻触即行" />
                <div className="text-ink-secondary space-y-2 text-xs leading-6">
                  <p>灵药成熟时，轻点即可采得一株。</p>
                  <p>尚在生长的灵植若可照料，轻点即可替道友聚灵。</p>
                  <p>若此茬已有人照料或采过，点开仍可查看它的长势。</p>
                </div>
              </InkCard>
            )}
          </aside>
        </div>
      </div>
      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </SectScene>
  );
}

function HerbPlot({
  plot,
  now,
  isSelf,
  busy,
  onClick,
}: {
  plot: HerbGardenPlotView;
  now: number;
  isSelf: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  if (plot.status === 'empty') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!isSelf || busy}
        className="text-ink-secondary relative min-h-44 overflow-hidden border border-current/15 bg-[repeating-linear-gradient(170deg,rgba(78,65,44,0.055)_0_1px,transparent_1px_24px),linear-gradient(150deg,rgba(238,229,202,0.58),rgba(217,204,170,0.34))] p-3 disabled:cursor-default sm:min-h-48"
      >
        <span className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="text-ink/35 block text-4xl font-light">＋</span>
            <span className="mt-2 block text-xs tracking-[0.16em]">
              {isSelf ? '播种' : '空地'}
            </span>
          </span>
        </span>
      </button>
    );
  }

  const ready = plot.status === 'ready';
  const mutation = Boolean(
    ready && plot.mutationRank && plot.mutationRank !== plot.herbRank,
  );
  const progress = getGrowthProgress(plot, now);
  const actionHint = mutation
    ? '灵机异动 · 点击收取'
    : ready
      ? isSelf
        ? '已成熟 · 点击收取'
        : plot.canSteal
          ? '药香正盛 · 点击采一株'
          : '灵药已成'
      : !isSelf && plot.canHelp
        ? '草木生发 · 点击聚灵'
        : formatRemaining(plot.readyAt, now);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="relative min-h-44 overflow-hidden border border-current/15 bg-[repeating-linear-gradient(170deg,rgba(78,65,44,0.07)_0_1px,transparent_1px_24px),linear-gradient(150deg,rgba(236,226,198,0.72),rgba(210,198,164,0.48))] p-3 text-left transition-transform hover:-translate-y-0.5 disabled:transform-none disabled:cursor-wait sm:min-h-48"
    >
      <div className="flex items-start justify-end">
        {plot.element ? (
          <span className="text-ink-secondary border border-current/15 bg-bgpaper/45 px-2 py-0.5 text-[10px]">
            {plot.element}属
          </span>
        ) : null}
      </div>

      <PlantGlyph ready={ready} mutation={mutation} />

      <div className="absolute inset-x-0 bottom-0 border-t border-current/10 bg-bgpaper/70 px-3 py-2.5 backdrop-blur-[1px]">
        <div className="flex items-end justify-between gap-2">
          <strong className="font-medium tracking-[0.08em]">{plot.herbName}</strong>
          <span className="text-ink-secondary text-[10px]">
            {plot.herbRank} · {plot.seedQuality}
          </span>
        </div>
        {!ready ? (
          <div className="bg-ink/10 mt-2 h-px">
            <div
              className="bg-ink/35 h-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
        <div
          className={`mt-1.5 text-[10px] ${
            ready || (!isSelf && plot.canHelp)
              ? mutation
                ? 'text-amber-800'
                : 'text-crimson'
              : 'text-ink-secondary'
          }`}
        >
          {actionHint}
        </div>
      </div>
    </button>
  );
}

function PlantGlyph({
  ready,
  mutation,
}: {
  ready: boolean;
  mutation: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-9 grid place-items-center">
      <div
        className={`relative text-center ${
          mutation ? 'text-amber-800 drop-shadow-[0_0_8px_rgba(146,104,30,0.25)]' : 'text-ink/45'
        }`}
      >
        {mutation ? (
          <span className="absolute -left-7 -top-2 animate-pulse text-base">✦</span>
        ) : null}
        <span className="block text-5xl leading-none sm:text-6xl">
          {ready ? '♣' : '♧'}
        </span>
        <span className="text-ink-secondary mt-1 block text-[10px] tracking-[0.24em]">
          {mutation ? '灵机乍现' : ready ? '药香已成' : '草木生发'}
        </span>
      </div>
    </div>
  );
}

function PlotDetail({
  plot,
  now,
  isSelf,
}: {
  plot: HerbGardenPlotView;
  now: number;
  isSelf: boolean;
}) {
  const mutation = Boolean(
    plot.status === 'ready' &&
      plot.mutationRank &&
      plot.mutationRank !== plot.herbRank,
  );
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-secondary text-xs">
        {PLOT_DETAIL_LABELS[plot.slot - 1]}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-current/10 pb-3 text-xs">
        <DetailLine label="灵药品阶" value={plot.herbRank ?? '—'} />
        <DetailLine label="种子种质" value={plot.seedQuality ?? '—'} />
        <DetailLine
          label="成熟状态"
          value={
            plot.status === 'ready'
              ? '已成熟'
              : formatRemaining(plot.readyAt, now)
          }
        />
        <DetailLine
          label="当前药量"
          value={`${plot.remainingYield ?? 0} / ${plot.baseYield ?? 0}株`}
        />
        <DetailLine
          label="灵变机缘"
          value={`${((plot.mutationChance ?? 0) * 100).toFixed(2)}%`}
        />
        <DetailLine
          label="留种机缘"
          value={`${((plot.seedReturnChance ?? 0) * 100).toFixed(0)}%`}
        />
      </div>

      {mutation ? (
        <div className="border-l-2 border-amber-800/35 bg-amber-800/5 px-3 py-2 text-xs leading-6">
          <strong>天地灵机异动。</strong>{' '}
          此株成熟时显出异象，收获时可得更珍稀的「{plot.mutationRank}」灵药。
        </div>
      ) : null}

      {plot.modifiers?.length ? (
        <div>
          <p className="text-ink-secondary mb-2 text-xs tracking-[0.12em]">
            草木缘法
          </p>
          <div className="space-y-2">
            {plot.modifiers.map((modifier, index) => (
              <div
                key={`${modifier.source}-${index}`}
                className="border-ink/15 border-l pl-3 text-xs leading-5"
              >
                <strong>{modifier.label}</strong>
                <p className="text-ink-secondary">{modifier.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isSelf && (plot.stealLimit ?? 0) > 0 ? (
        <p className="text-ink-secondary border-t border-current/10 pt-3 text-xs leading-6">
          此茬尚可供好友采撷 {Math.max(0, (plot.stealLimit ?? 0) - (plot.stolenCount ?? 0))} 株。
        </p>
      ) : null}
    </div>
  );
}

function SeedChoice({
  seed,
  disabled,
  onPlant,
}: {
  seed: HerbGardenSeedStack;
  disabled: boolean;
  onPlant: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-current/10 pb-2 last:border-0">
      <div>
        <p className="text-sm">{seed.herbName} · {seed.seedQuality}</p>
        <p className="text-ink-secondary mt-1 text-xs">
          {seed.herbRank} · {seed.element}属 · 储物袋 ×{seed.quantity} · 药圃 Lv.{seed.minGardenLevel}+
        </p>
      </div>
      <InkButton
        variant="primary"
        disabled={disabled}
        onClick={() => void onPlant()}
      >
        播种
      </InkButton>
    </div>
  );
}

function PanelTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-current/10 pb-2">
      <strong className="text-sm tracking-[0.1em]">{title}</strong>
      <span className="text-ink-secondary text-[10px]">{meta}</span>
    </div>
  );
}

function Metric({
  value,
  label,
  emphasize = false,
}: {
  value: string;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="px-1">
      <strong
        className={`block text-base font-medium ${
          emphasize ? 'text-crimson' : 'text-ink/70'
        }`}
      >
        {value}
      </strong>
      <span className="text-ink-secondary text-[10px]">{label}</span>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-secondary">{label}</span>
      <strong className="font-medium">{value}</strong>
    </div>
  );
}

function getGrowthProgress(plot: HerbGardenPlotView, now: number): number {
  if (plot.status === 'ready') return 1;
  const plantedAt = plot.plantedAt ? new Date(plot.plantedAt).getTime() : now;
  const readyAt = plot.readyAt ? new Date(plot.readyAt).getTime() : now;
  if (readyAt <= plantedAt) return 1;
  return Math.max(0, Math.min(1, (now - plantedAt) / (readyAt - plantedAt)));
}

function formatRemaining(readyAt: string | undefined, now: number): string {
  if (!readyAt) return '—';
  const remaining = Math.max(0, new Date(readyAt).getTime() - now);
  const minutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `剩余 ${hours}时${rest}分` : `剩余 ${rest}分`;
}
