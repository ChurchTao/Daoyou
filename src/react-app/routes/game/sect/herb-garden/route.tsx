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
import { useEffect, useState, type ReactNode } from 'react';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';

const SLOT_LABELS = ['壹号畦', '贰号畦', '叁号畦', '肆号畦', '伍号畦', '陆号畦'];

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

  const showSeedPicker = (slot: number) => {
    const available = state.seeds.filter(
      (seed) => seed.quantity > 0 && seed.minGardenLevel <= state.gardenLevel,
    );
    setDialog({
      id: `seed-${slot}`,
      title: `【${SLOT_LABELS[slot - 1]} · 选择灵种】`,
      confirmLabel: null,
      cancelLabel: '收起种匣',
      content:
        available.length === 0 ? (
          <p className="text-ink-secondary text-sm leading-7">
            当前没有可用于此级药圃的灵种。收获时有机会留种，后续也可从玩法奖励中获得更多灵种。
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
        ),
    });
  };

  const showPlot = (plot: HerbGardenPlotView) => {
    if (plot.status === 'empty') {
      if (isSelf) showSeedPicker(plot.slot);
      return;
    }

    const ready = plot.status === 'ready';
    const actionLabel = isSelf
      ? ready
        ? '收获此畦'
        : null
      : ready
        ? plot.canSteal
          ? '顺手采一株'
          : null
        : plot.canHelp
          ? '替道友聚灵'
          : null;

    setDialog({
      id: plot.plotId ?? `plot-${plot.slot}`,
      title: `【${plot.herbName ?? '灵植'}】`,
      confirmLabel: actionLabel,
      cancelLabel: '返回药田',
      content: <PlotDetail plot={plot} now={now} isSelf={isSelf} />,
      onConfirm:
        actionLabel && plot.plotId
          ? async () => {
              try {
                if (isSelf) {
                  const result = await garden.harvest(plot.plotId!);
                  const mutation = result.result.mutation
                    ? `，灵变得「${result.result.mutation.name} ×1」`
                    : '';
                  pushToast({
                    message: `收获${result.result.herbName} ×${result.result.quantity}${mutation}`,
                    tone: 'success',
                  });
                } else if (ready && plot.canSteal) {
                  const result = await garden.steal(
                    state.owner.cultivatorId,
                    plot.plotId!,
                  );
                  pushToast({
                    message: `四下无人……你顺手采走了「${result.result.herbName} ×1」。`,
                    tone: 'success',
                  });
                } else if (plot.canHelp) {
                  await garden.help(state.owner.cultivatorId, plot.plotId!);
                  pushToast({
                    message: '你替道友引来一缕灵气。',
                    tone: 'success',
                  });
                }
              } catch {
                // 服务端原因会留在页面错误区。
              }
            }
          : undefined,
    });
  };

  return (
    <SectScene sceneKey="herbGarden" mood="garden">
      <div className="space-y-4">
        {!isSelf ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
            <div>
              <p className="text-ink-secondary text-xs tracking-[0.22em]">
                访友药田 · 持访客令入圃
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

        {garden.error ? <GameSceneNote tone="danger">{garden.error}</GameSceneNote> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="relative overflow-hidden border border-emerald-950/15 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.42),transparent_26%),linear-gradient(180deg,rgba(151,180,139,0.14),rgba(113,91,58,0.08))] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium tracking-[0.12em]">
                  {state.owner.name}的灵田
                </p>
                <p className="text-ink-secondary mt-1 text-xs">
                  宗门药圃 Lv.{state.gardenLevel} · 六畦轮作 · 灵药成熟后方可采收
                </p>
              </div>
              <span className="border border-emerald-900/15 bg-bgpaper/45 px-3 py-1.5 text-xs text-emerald-950/70">
                草木灵机 · 平稳
              </span>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
              <GardenTag>种子影响本轮种质</GardenTag>
              <GardenTag>灵根契合可加速</GardenTag>
              <GardenTag>命格共鸣自动结算</GardenTag>
              {!isSelf ? <GardenTag>好友采药不复制产出</GardenTag> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {state.plots.map((plot) => (
                <HerbPlot
                  key={plot.slot}
                  plot={plot}
                  now={now}
                  isSelf={isSelf}
                  onClick={() => showPlot(plot)}
                />
              ))}
            </div>

            <div className="text-ink-secondary mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-3 text-[11px]">
              <span>访客采走一株，田中即真实减少一株；单茬最多开放约 20% 访采份额。</span>
              <span>异变采用价值转换，不额外复制基础产量。</span>
            </div>
          </section>

          <aside className="space-y-3">
            <InkCard className="mb-0" padding="md">
              <PanelTitle title="今日药田" meta={isSelf ? '我的灵圃' : '访友'} />
              <div className="grid grid-cols-3 divide-x divide-current/10 text-center">
                <Metric value={`${state.summary.planted}/6`} label="种植" />
                <Metric value={String(state.summary.ready)} label="成熟" />
                <Metric
                  value={`${(state.summary.averageMutationChance * 100).toFixed(1)}%`}
                  label="平均灵变"
                />
              </div>
            </InkCard>

            {isSelf ? (
              <InkCard className="mb-0" padding="md">
                <PanelTitle title="灵种匣" meta={`${state.seeds.length}类`} />
                <div className="space-y-2">
                  {state.seeds.length === 0 ? (
                    <p className="text-ink-secondary text-xs">暂无灵种。</p>
                  ) : (
                    state.seeds.slice(0, 5).map((seed) => (
                      <div
                        key={seed.materialId}
                        className="flex items-center justify-between border-b border-dashed border-current/10 pb-2 text-xs last:border-0 last:pb-0"
                      >
                        <span>{seed.herbName} · {seed.seedQuality}</span>
                        <span className="text-ink-secondary">×{seed.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </InkCard>
            ) : null}

            <InkCard className="mb-0" padding="md">
              <PanelTitle title="访田记录" meta={`${state.logs.length}条`} />
              <div className="space-y-2">
                {state.logs.length === 0 ? (
                  <p className="text-ink-secondary text-xs leading-6">
                    今日田间清静，尚无人留下足迹。
                  </p>
                ) : (
                  state.logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="border-b border-dashed border-current/10 pb-2 text-xs leading-5 last:border-0 last:pb-0"
                    >
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </InkCard>

            {isSelf ? (
              <InkCard className="mb-0" padding="md">
                <PanelTitle title="药田行动" meta="轻操作" />
                <div className="grid grid-cols-2 gap-2">
                  <InkButton
                    variant="primary"
                    disabled={garden.busy || state.summary.ready === 0}
                    onClick={() => {
                      void garden
                        .harvestAll()
                        .then((result) => {
                          const total = result.results.reduce(
                            (sum, item) =>
                              sum + item.quantity + (item.mutation ? 1 : 0),
                            0,
                          );
                          pushToast({
                            message: `一键收获完成，共收入 ${total} 份灵药。`,
                            tone: 'success',
                          });
                        })
                        .catch(() => undefined);
                    }}
                  >
                    一键收获
                  </InkButton>
                  <InkButton
                    disabled={garden.busy}
                    onClick={() => {
                      const empty = state.plots.find(
                        (plot) => plot.status === 'empty',
                      );
                      if (empty) showSeedPicker(empty.slot);
                      else
                        pushToast({
                          message: '六块灵畦都已有灵植。',
                          tone: 'warning',
                        });
                    }}
                  >
                    播种
                  </InkButton>
                </div>
              </InkCard>
            ) : null}

            {isSelf ? (
              <InkCard className="mb-0" padding="md">
                <PanelTitle title="好友药田" meta="可回访" />
                <div className="space-y-2">
                  {state.friends.length === 0 ? (
                    <p className="text-ink-secondary text-xs leading-6">
                      好友名录尚空。结识道友后，可持访客令互访药田。
                    </p>
                  ) : (
                    state.friends.slice(0, 8).map((friend) => (
                      <button
                        key={friend.cultivatorId}
                        type="button"
                        className="hover:bg-ink/5 flex w-full items-center justify-between border-b border-dashed border-current/10 py-1.5 text-left text-xs last:border-0"
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
                            ? `${friend.readyPlots}畦成熟`
                            : friend.growingPlots > 0
                              ? '生长中'
                              : '空田'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </InkCard>
            ) : null}
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
  onClick,
}: {
  plot: HerbGardenPlotView;
  now: number;
  isSelf: boolean;
  onClick: () => void;
}) {
  if (plot.status === 'empty') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!isSelf}
        className="relative min-h-48 overflow-hidden border border-stone-900/20 bg-[repeating-linear-gradient(170deg,rgba(62,45,30,0.09)_0_2px,transparent_2px_22px),linear-gradient(150deg,rgba(132,105,72,0.48),rgba(102,82,58,0.52))] p-3 text-left disabled:cursor-default sm:min-h-52"
      >
        <span className="text-bgpaper/75 text-[10px] tracking-[0.15em]">
          {SLOT_LABELS[plot.slot - 1]}
        </span>
        <span className="absolute inset-0 grid place-items-center text-center text-bgpaper/80">
          <span>
            <span className="block text-4xl font-light">＋</span>
            <span className="mt-1 block text-xs tracking-[0.18em]">
              {isSelf ? '播下灵种' : '空闲灵畦'}
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
  const status = mutation
    ? '灵机异动'
    : ready
      ? isSelf
        ? '可收获'
        : plot.canSteal
          ? '可采一株'
          : '已成熟'
      : !isSelf && plot.canHelp
        ? '可聚灵'
        : '生长中';

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative min-h-48 overflow-hidden border border-stone-900/25 bg-[repeating-linear-gradient(170deg,rgba(62,45,30,0.13)_0_2px,transparent_2px_22px),linear-gradient(150deg,rgba(125,96,62,0.72),rgba(91,73,51,0.75))] p-3 text-left transition-transform hover:-translate-y-0.5 sm:min-h-52"
    >
      <div className="flex items-start justify-between gap-2 text-[10px]">
        <span className="text-bgpaper/75 tracking-[0.15em]">
          {SLOT_LABELS[plot.slot - 1]}
        </span>
        <span className="border border-bgpaper/20 bg-bgpaper/80 px-2 py-0.5 text-stone-800">
          {status}
        </span>
      </div>
      <PlantGlyph element={plot.element} ready={ready} mutation={mutation} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/85 via-stone-900/72 to-transparent px-3 pb-3 pt-9 text-bgpaper">
        <div className="flex items-end justify-between gap-2">
          <strong className="font-medium tracking-[0.08em]">{plot.herbName}</strong>
          <span className="text-[10px] text-stone-200/80">
            {plot.herbRank} · {plot.seedQuality}
          </span>
        </div>
        <div className="mt-2 h-0.5 bg-white/15">
          <div
            className="h-full bg-lime-200/70"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-stone-200/85">
          <span>{ready ? '已成熟' : formatRemaining(plot.readyAt, now)}</span>
          <span>灵变 {((plot.mutationChance ?? 0) * 100).toFixed(1)}%</span>
        </div>
      </div>
    </button>
  );
}

function PlantGlyph({
  element,
  ready,
  mutation,
}: {
  element?: string;
  ready: boolean;
  mutation: boolean;
}) {
  const accent =
    element === '火'
      ? 'text-orange-200'
      : element === '水' || element === '冰'
        ? 'text-cyan-100'
        : element === '雷'
          ? 'text-amber-100'
          : 'text-lime-100';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-11 grid place-items-center">
      <div
        className={`relative text-center ${accent} ${
          mutation ? 'drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]' : ''
        }`}
      >
        {mutation ? (
          <span className="absolute -left-8 -top-3 animate-pulse text-lg">✦</span>
        ) : null}
        <span className="block text-5xl leading-none sm:text-6xl">
          {ready ? '♣' : '♧'}
        </span>
        <span className="mt-1 block text-[10px] tracking-[0.28em] text-bgpaper/70">
          {ready ? '灵药已成' : '草木生发'}
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-current/10 pb-3 text-xs">
        <DetailLine label="灵药品阶" value={plot.herbRank ?? '—'} />
        <DetailLine label="种子种质" value={plot.seedQuality ?? '—'} />
        <DetailLine
          label="成熟状态"
          value={plot.status === 'ready' ? '已成熟' : formatRemaining(plot.readyAt, now)}
        />
        <DetailLine
          label="当前药量"
          value={`${plot.remainingYield ?? 0} / ${plot.baseYield ?? 0}株`}
        />
        <DetailLine
          label="灵变概率"
          value={`${((plot.mutationChance ?? 0) * 100).toFixed(2)}%`}
        />
        <DetailLine
          label="留种概率"
          value={`${((plot.seedReturnChance ?? 0) * 100).toFixed(0)}%`}
        />
      </div>

      {mutation ? (
        <div className="border-l-2 border-amber-700/50 bg-amber-800/5 px-3 py-2 text-xs leading-6">
          <strong>天地灵机异动。</strong> 此株成熟时出现罕见灵变；结算会把一份普通产量转换为「{plot.mutationRank}」灵药，不额外复制基础数量。
        </div>
      ) : null}

      {plot.modifiers?.length ? (
        <div>
          <p className="text-ink-secondary mb-2 text-xs tracking-[0.12em]">
            本轮生效缘由
          </p>
          <div className="space-y-2">
            {plot.modifiers.map((modifier, index) => (
              <div
                key={`${modifier.source}-${index}`}
                className="border-l border-emerald-900/30 pl-3 text-xs leading-5"
              >
                <strong>{modifier.label}</strong>
                <p className="text-ink-secondary">{modifier.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isSelf ? (
        <p className="text-ink-secondary border-t border-current/10 pt-3 text-xs leading-6">
          本茬访客已采 {plot.stolenCount ?? 0}/{plot.stealLimit ?? 0} 株；每位好友每茬最多采一株，帮助聚灵最多接受三位道友。
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
          {seed.herbRank} · {seed.element}属 · 持有 ×{seed.quantity} · 药圃 Lv.{seed.minGardenLevel}+
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

function GardenTag({ children }: { children: ReactNode }) {
  return (
    <span className="border border-emerald-950/15 bg-bgpaper/40 px-2 py-1 text-emerald-950/70">
      {children}
    </span>
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

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <strong className="block text-base font-medium text-emerald-950/75">{value}</strong>
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
