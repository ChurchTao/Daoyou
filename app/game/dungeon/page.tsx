'use client';

import {
  InkButton,
  InkCard,
  InkList,
  InkListItem,
  InkNotice,
  InkTag,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { DungeonOption, DungeonRound, DungeonState } from '@/lib/dungeon/types';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { useEffect, useState } from 'react';

// Theme options
const THEMES = ['古修士洞府', '崩塌的上古宗门', '乱星海无名荒岛', '坠魔谷外围'];

export default function DungeonPage() {
  const { cultivator, isLoading: isCultivatorLoading } = useCultivatorBundle();
  const { pushToast } = useInkUI();

  const [dungeonState, setDungeonState] = useState<DungeonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [lastRoundData, setLastRoundData] = useState<DungeonRound | null>(null); // For immediate display update

  // Fetch initial state
  useEffect(() => {
    async function fetchState() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/dungeon/state?cultivatorId=${cultivator!.id}`,
        );
        const data = await res.json();
        if (data.state) {
          setDungeonState(data.state);
          // Restore lastRoundData for UI rendering
          if (
            !data.state.isFinished &&
            data.state.history &&
            data.state.history.length > 0
          ) {
            const lastHistory =
              data.state.history[data.state.history.length - 1];
            setLastRoundData({
              scene_description: lastHistory.scene,
              interaction: {
                options: data.state.currentOptions || [],
              },
              status_update: {
                is_final_round: data.state.currentRound >= data.state.maxRounds,
                internal_danger_score: data.state.dangerScore,
              },
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    if (cultivator?.id) {
      fetchState();
    } else if (!isCultivatorLoading && !cultivator) {
      setLoading(false);
    }
  }, [cultivator, isCultivatorLoading]);

  const handleStart = async () => {
    if (!cultivator) return;
    try {
      setLoading(true);
      const res = await fetch('/api/dungeon/start', {
        method: 'POST',
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          theme: selectedTheme,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setDungeonState(data.state);
      setLastRoundData(data.roundData as DungeonRound);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '开启副本失败';
      pushToast({ message: msg, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (option: DungeonOption) => {
    if (!cultivator || !dungeonState) return;
    try {
      setProcessingAction(true);
      const res = await fetch('/api/dungeon/action', {
        method: 'POST',
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          choiceId: option.id,
          choiceText: option.text,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.isFinished) {
        // Finished
        setDungeonState(null); // Clear active state
        setLastRoundData(null);
        // Show settlement modal or redirect?
        // The API returns `settlement`.
        // Let's show a settlement view.
        pushToast({ message: '探索结束！', tone: 'success' });
        // Ideally show a result card.
        // I'll stick the result in a local state to show "Run Completed" screen.
        setDungeonState({
          ...data.state,
          isFinished: true,
          settlement: data.settlement,
        });
      } else {
        setDungeonState(data.state);
        setLastRoundData(data.roundData);
      }
    } catch (e: any) {
      pushToast({ message: e.message || '行动失败', tone: 'danger' });
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading || isCultivatorLoading) {
    return (
      <InkPageShell title="...推演中...">
        <div className="flex justify-center p-12">
          <p className="animate-pulse">天机混沌，正在解析...</p>
        </div>
      </InkPageShell>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell title="单人副本">
        <InkNotice tone="warning">请先登录或创建角色</InkNotice>
      </InkPageShell>
    );
  }

  // Finished View
  if (dungeonState?.isFinished) {
    const settlement = (dungeonState as any).settlement;
    return (
      <InkPageShell title="探索结束" backHref="/game">
        <InkCard className="p-4 space-y-4">
          <p className="text-ink/80 leading-relaxed">
            {settlement?.ending_narrative}
          </p>

          <div className="bg-paper-dark p-4 rounded text-center">
            <div className="text-base text-ink-secondary">评价</div>
            <div className="text-4xl text-crimson my-2">
              {settlement?.settlement.reward_tier}
            </div>
            <div className="text-base text-ink-secondary">获得机缘</div>
          </div>

          {settlement?.settlement.potential_items?.length > 0 && (
            <InkList dense>
              {settlement.settlement.potential_items.map(
                (item: string, idx: number) => (
                  <InkListItem key={idx} title={item} />
                ),
              )}
            </InkList>
          )}
          <InkButton
            href="/"
            variant="primary"
            className="w-full text-center block mt-4"
          >
            返回
          </InkButton>
        </InkCard>
      </InkPageShell>
    );
  }

  // Active View
  if (dungeonState && lastRoundData) {
    const round = dungeonState.currentRound;
    const max = dungeonState.maxRounds;

    return (
      <InkPageShell
        title={`${dungeonState.theme} (${round}/${max})`}
        backHref="/"
        statusBar={
          <div className="flex justify-between text-xs text-ink-secondary px-2">
            <span>危: {dungeonState.dangerScore ?? 0}</span>
            <span>道友: {cultivator.name}</span>
          </div>
        }
      >
        <InkCard className="mb-6 min-h-[200px] flex flex-col justify-center">
          <p className="text-lg leading-relaxed text-ink">
            {lastRoundData.scene_description}
          </p>
        </InkCard>

        <InkSection title="抉择时刻" hint="一念成仙，一念成魔">
          <div className="space-y-3">
            {lastRoundData.interaction.options.map((opt: DungeonOption) => (
              <button
                key={opt.id}
                disabled={processingAction}
                onClick={() => handleAction(opt)}
                className={`w-full text-left p-4 rounded border transition-all 
                                   ${processingAction ? 'opacity-50 cursor-not-allowed' : 'hover:border-crimson hover:bg-paper-dark'}
                                   border-ink/20 bg-paper`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">[{opt.text}]</span>
                  <InkTag
                    tone={
                      opt.risk_level === 'high'
                        ? 'bad'
                        : opt.risk_level === 'medium'
                          ? 'info'
                          : 'good'
                    }
                    variant="outline"
                    className="text-xs"
                  >
                    {opt.risk_level === 'high'
                      ? '凶险'
                      : opt.risk_level === 'medium'
                        ? '莫测'
                        : '稳健'}
                  </InkTag>
                </div>
                {opt.content && (
                  <div className="text-sm text-ink-secondary mt-1">
                    {opt.content}
                  </div>
                )}
                {opt.requirement && (
                  <div className="text-xs text-crimson mt-2">
                    需: {opt.requirement}
                  </div>
                )}
                {opt.potential_cost && (
                  <div className="text-xs text-ink-secondary mt-1">
                    代价: {opt.potential_cost}
                  </div>
                )}
                {opt.costs && opt.costs.length > 0 && (
                  <div className="text-xs text-ink-secondary mt-1">
                    {opt.costs.map((c, i) => (
                      <span key={i} className="mr-2">
                        [{c.desc || `${c.type} ${c.value}`}]
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </InkSection>

        {dungeonState.history.length > 0 && (
          <InkSection title="前尘往事" subdued>
            <div className="text-sm space-y-2 text-ink-secondary max-h-40 overflow-y-auto px-2">
              {dungeonState.history.map((h, i) => (
                <div key={i} className="border-l-2 border-ink/10 pl-2">
                  <div className="font-bold">第{h.round}回</div>
                  <div>{h.scene.substring(0, 50)}...</div>
                  {h.choice && <div className="text-crimson">➜ {h.choice}</div>}
                </div>
              ))}
            </div>
          </InkSection>
        )}
      </InkPageShell>
    );
  }

  // Start Screen (Active state null)
  return (
    <InkPageShell title="云游探秘" backHref="/game" subtitle="寻找上古机缘">
      <InkCard className="p-6 mb-6">
        <div className="text-center space-y-4">
          <div className="text-6xl my-4">🏔️</div>
          <p>
            修仙界广袤无垠，机缘与危机并存。
            <br />
            道友可愿前往，体悟一段未知的旅程？
          </p>
        </div>
      </InkCard>

      <InkSection title="选择秘境">
        <div className="grid grid-cols-1 gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTheme(t)}
              className={`p-3 text-left border rounded transition
                                 ${selectedTheme === t ? 'border-crimson bg-crimson/5 text-crimson' : 'border-ink/10 hover:border-ink/30'}`}
            >
              {selectedTheme === t ? '🔘' : '◯'} {t}
            </button>
          ))}
        </div>
      </InkSection>

      <div className="mt-8">
        <InkButton
          variant="primary"
          className="w-full text-center justify-center py-4 text-lg"
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? '推演中...' : '开启探险'}
        </InkButton>
        <p className="text-center text-xs text-ink-secondary mt-2">
          * 每日仅可探索一次（暂无限制）
        </p>
      </div>
    </InkPageShell>
  );
}
