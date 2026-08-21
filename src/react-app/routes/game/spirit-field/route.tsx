import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type { SpiritFieldCarePlan } from '@shared/engine/spirit-field';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SeedView = {
  materialId: string;
  plantId: string;
  name: string;
  quantity: number;
  quality: string;
  element: string | null;
  plantName: string;
  minRealm: string;
  canPlant: boolean;
};

type PlotView = {
  index: number;
  plantId: string | null;
  plantedAt: string | null;
  careCount: number;
  lastCareAt: string | null;
  unlocked: boolean;
  unlockRule: { index: number; minRealm: string; minHarvest: number };
  plant: null | {
    id: string;
    name: string;
    quality: string;
    element: string;
    description: string;
    careSlots: number;
    careCooldownMs: number;
  };
  progress: number;
  mature: boolean;
  remainingMs: number;
  nextCareAt: number | null;
  canCare: boolean;
  observations: Array<{
    topic: 'leaf' | 'soil' | 'aura';
    label: string;
    text: string;
    suggestedAction: string;
  }>;
};

type SpiritFieldSnapshot = {
  profile: {
    level: number;
    levelName: string;
    speedBonus: number;
    selfHarvestCount: number;
    totalCareCount: number;
    starterClaimed: boolean;
  };
  player: {
    realm: string;
    spiritStones: number;
    qi: number;
    qiMax: number;
  };
  upgrade: null | {
    nextLevel: number;
    name: string;
    cost: number;
  };
  plots: PlotView[];
  seeds: SeedView[];
  careItems: Array<{
    materialId: string;
    name: string;
    quantity: number;
    quality: string;
    effect: string;
    power: number;
  }>;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

const quickCareMessages = [
  '我轻轻疏松根部附近的土壤，让湿气与灵机重新流转。',
  '我运转木灵力，小心温养根须，不强行催生。',
  '我只引少量灵泉润泽叶面，避免让根部继续积水。',
  '我用极细的火灵力驱散土中湿气，但刻意避开药根。',
] as const;

function requestId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

function formatDuration(ms: number) {
  if (ms <= 0) return '已成熟';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `约 ${hours} 小时 ${rest} 分钟` : `约 ${hours} 小时`;
}

function observationTone(topic: PlotView['observations'][number]['topic']) {
  if (topic === 'soil') return '土壤';
  if (topic === 'leaf') return '叶色';
  return '灵气';
}

async function readSnapshot(): Promise<SpiritFieldSnapshot> {
  const response = await fetch('/api/spirit-field', { cache: 'no-store' });
  const payload = (await response.json()) as ApiEnvelope<SpiritFieldSnapshot>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || payload.message || '灵田暂时无法查看');
  }
  return payload.data;
}

export default function SpiritFieldPage() {
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [snapshot, setSnapshot] = useState<SpiritFieldSnapshot | null>(null);
  const [clockMs, setClockMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [careMessage, setCareMessage] = useState('');
  const [carePlan, setCarePlan] = useState<SpiritFieldCarePlan | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const next = await readSnapshot();
      setSnapshot(next);
      setClockMs(Date.now());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '灵田暂时无法查看');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/spirit-field', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiEnvelope<SpiritFieldSnapshot>;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || payload.message || '灵田暂时无法查看');
        }
        if (!controller.signal.aborted) {
          setSnapshot(payload.data);
          setClockMs(Date.now());
          setError(null);
        }
      } catch (nextError) {
        if (!controller.signal.aborted) {
          setError(
            nextError instanceof Error ? nextError.message : '灵田暂时无法查看',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const activePlotIndex =
    snapshot && snapshot.plots[selectedPlotIndex]
      ? selectedPlotIndex
      : 0;
  const selectedPlot = snapshot?.plots[activePlotIndex] ?? null;
  const usableSeeds = useMemo(
    () => snapshot?.seeds.filter((seed) => seed.quantity > 0) ?? [],
    [snapshot],
  );

  const performMutation = useCallback(
    async <T,>(url: string, body: unknown, successMessage?: string): Promise<T | null> => {
      setBusy(true);
      try {
        const result = await mutate<T>(
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
        await refresh(true);
        if (successMessage) pushToast({ message: successMessage, tone: 'success' });
        return result;
      } catch (nextError) {
        pushToast({
          message: nextError instanceof Error ? nextError.message : '灵田操作失败',
          tone: 'danger',
        });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [mutate, pushToast, refresh],
  );

  const claimStarter = async () => {
    await performMutation('/api/spirit-field/starter', {}, '初始灵种已收入储物袋');
  };

  const sow = async (seed: SeedView) => {
    if (!selectedPlot) return;
    await performMutation(
      '/api/spirit-field/sow',
      { plotIndex: selectedPlot.index, seedMaterialId: seed.materialId },
      `已种下${seed.plantName}`,
    );
  };

  const openCareComposer = (message = '') => {
    setCarePlan(null);
    setCareMessage(message);
    setComposerOpen(true);
  };

  const interpretCare = async () => {
    if (!selectedPlot?.plant || !careMessage.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/spirit-field/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plotIndex: selectedPlot.index,
          message: careMessage.trim(),
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<SpiritFieldCarePlan>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || payload.message || '一时难辨你的打算，请换个说法再试');
      }
      setCarePlan(payload.data);
    } catch (nextError) {
      pushToast({
        message: nextError instanceof Error ? nextError.message : '一时难辨你的打算，请换个说法再试',
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const executeCare = async () => {
    if (!selectedPlot?.plant || !carePlan) return;
    if (carePlan.action === 'observe' || carePlan.action === 'wait') {
      pushToast({
        message: '你还未真正动手，这次不会消耗照料机会。换一种实际做法即可。',
        tone: 'warning',
      });
      return;
    }
    const result = await performMutation<{
      narrative: string;
      growthBoostPercent: number;
      qiCost: number;
      careCount: number;
      careSlots: number;
    }>(
      '/api/spirit-field/care',
      {
        plotIndex: selectedPlot.index,
        plan: carePlan,
        requestId: requestId('care'),
      },
    );
    if (!result) return;
    setComposerOpen(false);
    setCarePlan(null);
    setCareMessage('');
    openDialog({
      title: '照料结果',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>{result.narrative}</p>
          <div className="border-ink/15 border-t border-dashed pt-3 text-ink-secondary">
            <div>生长推进：+{result.growthBoostPercent}%</div>
            <div>天地灵气：-{result.qiCost}</div>
            <div>本株照料：{result.careCount} / {result.careSlots}</div>
          </div>
        </div>
      ),
      confirmLabel: '收下结果',
      onConfirm: async () => undefined,
    });
  };

  const harvest = async (mode: 'focused' | 'broad') => {
    if (!selectedPlot?.plant) return;
    const result = await performMutation<{
      narrative: string;
      rewards: Array<{ name: string; quantity: number; kind: string }>;
      selfHarvestCount: number;
    }>(
      '/api/spirit-field/harvest',
      {
        plotIndex: selectedPlot.index,
        mode,
        requestId: requestId('harvest'),
      },
    );
    if (!result) return;
    openDialog({
      title: mode === 'focused' ? '精心采收' : '广采百草',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>{result.narrative}</p>
          <div className="border-ink/15 border-t border-dashed pt-3">
            {result.rewards.map((reward, index) => (
              <div key={`${reward.name}-${index}`} className="flex justify-between gap-3">
                <span>{reward.name}</span>
                <span className="text-ink-secondary">×{reward.quantity}</span>
              </div>
            ))}
          </div>
          <p className="text-ink-secondary">自产累计：{result.selfHarvestCount} 株</p>
        </div>
      ),
      confirmLabel: '收入储物袋',
      onConfirm: async () => undefined,
    });
  };

  const upgrade = async () => {
    if (!snapshot?.upgrade) return;
    const next = snapshot.upgrade;
    openDialog({
      title: `升级为${next.name}？`,
      content: (
        <div className="space-y-2 text-sm leading-7">
          <p>升级会永久提高个人灵田的自然生长速度。</p>
          <p>本次消耗：{next.cost.toLocaleString()} 灵石。</p>
        </div>
      ),
      confirmLabel: `消耗 ${next.cost.toLocaleString()} 灵石`,
      cancelLabel: '再想想',
      onConfirm: async () => {
        await performMutation(
          '/api/spirit-field/upgrade',
          { requestId: requestId('upgrade') },
          `灵田已升级为${next.name}`,
        );
      },
    });
  };

  if (loading && !snapshot) {
    return <GameSceneLoading message="药圃晨雾未散……" />;
  }

  if (!snapshot) {
    return (
      <GameSceneFrame variant="workflow">
        <InkNotice tone="warning">{error ?? '灵田暂时无法查看'}</InkNotice>
        <InkButton onClick={() => void refresh()} variant="primary">
          再看看
        </InkButton>
      </GameSceneFrame>
    );
  }

  return (
    <GameSceneFrame
      variant="workflow"
      headerMeta={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-secondary">
          <span>田阶：<strong className="text-ink font-normal">{snapshot.profile.levelName}</strong></span>
          <span>天地灵气：<strong className="text-ink font-normal">{snapshot.player.qi}/{snapshot.player.qiMax}</strong></span>
          <span>自产：<strong className="text-ink font-normal">{snapshot.profile.selfHarvestCount}</strong></span>
          <span>生长加成：<strong className="text-ink font-normal">+{Math.round(snapshot.profile.speedBonus * 100)}%</strong></span>
        </div>
      }
      aside={
        <div className="space-y-4 text-sm leading-7">
          <section>
            <div className="text-battle-muted mb-2 text-xs tracking-[0.18em]">灵种</div>
            {!snapshot.profile.starterClaimed ? (
              <InkButton onClick={() => void claimStarter()} disabled={busy} variant="primary">
                领取初始灵种
              </InkButton>
            ) : usableSeeds.length ? (
              <div className="space-y-2">
                {usableSeeds.slice(0, 6).map((seed) => (
                  <div key={seed.materialId} className="flex items-center justify-between gap-3">
                    <span>{seed.name}</span>
                    <span className="text-ink-secondary">×{seed.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-ink-secondary">储物袋里暂无可播种灵种。</span>
            )}
          </section>
          <section className="border-ink/15 border-t border-dashed pt-4">
            <div className="text-battle-muted mb-2 text-xs tracking-[0.18em]">灵田提升</div>
            {snapshot.upgrade ? (
              <>
                <p>下一阶：{snapshot.upgrade.name}</p>
                <p className="text-ink-secondary">需要 {snapshot.upgrade.cost.toLocaleString()} 灵石</p>
                <InkButton
                  onClick={() => void upgrade()}
                  disabled={busy || snapshot.player.spiritStones < snapshot.upgrade.cost}
                >
                  升级灵田
                </InkButton>
              </>
            ) : (
              <span className="text-ink-secondary">药园已臻当前最高阶。</span>
            )}
          </section>
        </div>
      }
    >
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}

      <InkCard variant="elevated" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-7 text-ink-secondary">
            点一块田看长势。空田可播种，成熟灵植可采收；异常长势则可直接动手照料。
          </p>
          <span className="shrink-0 text-xs text-ink-secondary">{snapshot.player.realm}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {snapshot.plots.map((plot) => {
            const active = plot.index === activePlotIndex;
            const percent = Math.round(plot.progress * 100);
            return (
              <button
                key={plot.index}
                type="button"
                disabled={!plot.unlocked}
                onClick={() => {
                  setSelectedPlotIndex(plot.index);
                  setComposerOpen(false);
                  setCarePlan(null);
                }}
                className={`min-h-28 border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-crimson ${
                  active
                    ? 'border-crimson bg-crimson/5'
                    : 'border-ink/15 bg-paper/35 hover:border-crimson/45'
                } ${!plot.unlocked ? 'cursor-not-allowed opacity-55' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xl">{plot.plant ? (plot.mature ? '🌾' : '🌿') : plot.unlocked ? '🪴' : '🔒'}</span>
                  <span className="text-xs text-ink-secondary">第 {plot.index + 1} 块</span>
                </div>
                <div className="mt-2 text-sm font-medium text-ink">
                  {plot.plant ? plot.plant.name : plot.unlocked ? '空田' : '未开垦'}
                </div>
                {plot.plant ? (
                  <>
                    <div className="bg-ink/10 mt-3 h-2 overflow-hidden rounded-full">
                      <div className="h-full bg-crimson transition-[width]" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-ink-secondary">
                      <span>{plot.mature ? '可采收' : `${percent}%`}</span>
                      <span>{plot.careCount}/{plot.plant.careSlots} 护</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-xs leading-5 text-ink-secondary">
                    {plot.unlocked
                      ? '点击后从储物袋选一枚灵种。'
                      : `${plot.unlockRule.minRealm} · 自产 ${plot.unlockRule.minHarvest}`}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </InkCard>

      {selectedPlot ? (
        <InkCard padding="lg" className="space-y-4">
          {!selectedPlot.unlocked ? (
            <GameSceneNote>
              这块田仍在封土中。达到 {selectedPlot.unlockRule.minRealm}，并累计自产 {selectedPlot.unlockRule.minHarvest} 株灵药后才会开垦。
            </GameSceneNote>
          ) : !selectedPlot.plant ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-ink">选一枚灵种</div>
                <p className="mt-1 text-sm text-ink-secondary">灵种来自现有储物袋，播种后直接扣除 1 枚。</p>
              </div>
              {usableSeeds.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {usableSeeds.map((seed) => (
                    <button
                      key={seed.materialId}
                      type="button"
                      disabled={busy || !seed.canPlant}
                      onClick={() => void sow(seed)}
                      className="border-ink/15 hover:border-crimson/45 disabled:opacity-50 border px-3 py-3 text-left text-sm"
                    >
                      <div className="flex justify-between gap-3">
                        <span>{seed.plantName}</span>
                        <span className="text-ink-secondary">×{seed.quantity}</span>
                      </div>
                      <div className="mt-1 text-xs text-ink-secondary">{seed.quality} · {seed.element ?? '无'} · {seed.canPlant ? '可播种' : `需${seed.minRealm}`}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <InkNotice>储物袋里没有可播种的灵种。</InkNotice>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{selectedPlot.plant.name}</span>
                    <span className="border-ink/15 border px-2 py-0.5 text-xs text-ink-secondary">
                      {selectedPlot.plant.quality} · {selectedPlot.plant.element}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {selectedPlot.mature
                      ? '药性已足，可以采收。'
                      : `${formatDuration(selectedPlot.remainingMs)}成熟 · 照料 ${selectedPlot.careCount}/${selectedPlot.plant.careSlots}`}
                  </p>
                </div>
                <span className="text-xs text-ink-secondary">{Math.round(selectedPlot.progress * 100)}%</span>
              </div>

              {!selectedPlot.mature ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {selectedPlot.observations.map((observation) => (
                      <button
                        key={observation.topic}
                        type="button"
                        disabled={busy}
                        onClick={() => openCareComposer(observation.suggestedAction)}
                        className="border-ink/15 hover:border-crimson/45 border px-3 py-3 text-left"
                      >
                        <div className="text-xs tracking-[0.14em] text-crimson">{observationTone(observation.topic)}</div>
                        <div className="mt-1 text-sm leading-6 text-ink-secondary">{observation.text}</div>
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-ink-secondary">这株{selectedPlot.plant.name}似有些不适，你准备怎么做？</div>
                    <div className="flex flex-wrap gap-2">
                      {quickCareMessages.map((message) => (
                        <button
                          key={message}
                          type="button"
                          disabled={busy || !selectedPlot.canCare}
                          onClick={() => openCareComposer(message)}
                          className="border-ink/15 hover:border-crimson/45 disabled:opacity-50 border px-3 py-2 text-sm text-ink-secondary"
                        >
                          {message.includes('疏松')
                            ? '疏松土壤'
                            : message.includes('木灵力')
                              ? '木气温养'
                              : message.includes('灵泉')
                                ? '少量润叶'
                                : '微火祛湿'}
                        </button>
                      ))}
                      <InkButton
                        onClick={() => openCareComposer('')}
                        disabled={busy || !selectedPlot.canCare}
                        variant="primary"
                      >
                        自行施为
                      </InkButton>
                    </div>
                    {!selectedPlot.canCare ? (
                      <p className="mt-2 text-xs text-ink-secondary">
                        {selectedPlot.careCount >= selectedPlot.plant.careSlots
                          ? '这株灵植此轮已照料妥当。'
                          : selectedPlot.nextCareAt
                            ? `刚刚照料过，${formatDuration(selectedPlot.nextCareAt - clockMs)}后可再试。`
                            : '眼下还不宜再动它。'}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-7 text-ink-secondary">成熟后有两种采法：精心采收偏向冲击更高品质，广采百草偏向总产量与返种。</p>
                  <div className="flex flex-wrap gap-2">
                    <InkButton onClick={() => void harvest('focused')} disabled={busy} variant="primary">
                      精心采收
                    </InkButton>
                    <InkButton onClick={() => void harvest('broad')} disabled={busy}>
                      广采百草
                    </InkButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </InkCard>
      ) : null}

      {composerOpen && selectedPlot?.plant && !selectedPlot.mature ? (
        <InkCard variant="elevated" padding="lg" className="space-y-4">
          <div>
            <div className="text-sm font-medium text-ink">照料{selectedPlot.plant.name}</div>
            <p className="mt-1 text-sm text-ink-secondary">若已有自己的法子，也可直接写下准备如何施为。</p>
          </div>

          {!carePlan ? (
            <>
              <div>
                <div className="mb-2 text-xs tracking-[0.14em] text-battle-muted">常用手段</div>
                <div className="flex flex-wrap gap-2">
                  {['我以木灵力护住根须，', '我先疏松周围泥土，', '我用极细的火灵力驱散湿气，'].map((prefix) => (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => setCareMessage((current) => `${current.trim()} ${prefix}`.trim())}
                      className="text-crimson hover:text-crimson/80 text-sm"
                    >
                      ［{prefix.replace(/[，。]/g, '')}］
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs tracking-[0.14em] text-battle-muted">你准备……</div>
              <textarea
                value={careMessage}
                onChange={(event) => setCareMessage(event.target.value)}
                maxLength={240}
                rows={4}
                disabled={busy}
                className="border-ink/20 focus:border-crimson/50 w-full resize-none border bg-paper/40 px-3 py-3 text-sm leading-7 outline-none"
                placeholder="例如：我以微弱火灵力驱散土中湿气，同时护住根须……"
              />
              <div className="flex justify-end gap-2">
                <InkButton onClick={() => setComposerOpen(false)} disabled={busy}>暂且不动</InkButton>
                <InkButton onClick={() => void interpretCare()} disabled={busy || !careMessage.trim()} variant="primary" pending={busy} pendingLabel="斟酌中……">
                  定下此法
                </InkButton>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <GameSceneNote>
                <div className="font-medium text-ink">你心中已有计较</div>
                <p className="mt-1">{carePlan.summary}</p>
              </GameSceneNote>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="border-ink/15 border px-3 py-2"><span className="text-ink-secondary">此举：</span>{carePlan.reason}</div>
                <div className="border-ink/15 border px-3 py-2"><span className="text-ink-secondary">需灵气：</span>{carePlan.qiCost}</div>
                <div className="border-ink/15 border px-3 py-2"><span className="text-ink-secondary">留意：</span>{carePlan.risk}</div>
              </div>
              <div className="flex justify-end gap-2">
                <InkButton onClick={() => setCarePlan(null)} disabled={busy}>再斟酌</InkButton>
                <InkButton onClick={() => void executeCare()} disabled={busy} variant="primary" pending={busy} pendingLabel="施为中……">
                  施为
                </InkButton>
              </div>
            </div>
          )}
        </InkCard>
      ) : null}
    </GameSceneFrame>
  );
}
