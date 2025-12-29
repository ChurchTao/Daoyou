'use client';

import { BattlePageLayout } from '@/components/BattlePageLayout';
import { BattleReportViewer } from '@/components/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/BattleTimelineViewer';
import { LingGenMini } from '@/components/func';
import {
  InkBadge,
  InkButton,
  InkCard,
  InkList,
  InkListItem,
  InkNotice,
  InkTag,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { BattleEngineResult } from '@/engine/battle';
import {
  DungeonOption,
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@/lib/dungeon/types';
import { getMapNode, MapNodeInfo } from '@/lib/game/mapSystem';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { Cultivator } from '@/types/cultivator';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

function DungeonContent() {
  const { cultivator, isLoading: isCultivatorLoading } = useCultivatorBundle();
  const { pushToast, openDialog } = useInkUI();
  const searchParams = useSearchParams();
  const preSelectedNodeId = searchParams.get('nodeId');

  const [dungeonState, setDungeonState] = useState<DungeonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);

  // Battle State
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [battleEnd, setBattleEnd] = useState(false);
  const [opponentNameForBattle, setOpponentNameForBattle] =
    useState('神秘敌手'); // Metadata for UI

  const [lastRoundData, setLastRoundData] = useState<DungeonRound | null>(null); // For immediate display update

  // Battle Settlement Confirmation State
  const [battleSettlement, setBattleSettlement] = useState<{
    isFinished: boolean;
    settlement: DungeonSettlement;
  } | null>(null);

  // Pre-Battle State
  const [pendingBattle, setPendingBattle] = useState<{
    id: string;
    reason: string;
    enemyData?: Cultivator; // 敌人数据（查探后加载）
  } | null>(null);

  const [isProbing, setIsProbing] = useState(false); // 是否正在查探
  const [showEnemyDetails, setShowEnemyDetails] = useState(false); // 是否显示敌人详情

  const selectedMapNode = useMemo(() => {
    if (!preSelectedNodeId) return null;
    return getMapNode(preSelectedNodeId);
  }, [preSelectedNodeId]);

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
    if (!cultivator || !selectedMapNode) {
      if (!selectedMapNode)
        pushToast({ message: '请先选择探险地点', tone: 'warning' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/dungeon/start', {
        method: 'POST',
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          mapNodeId: selectedMapNode.id,
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
        pushToast({ message: '探索结束！', tone: 'success' });
        setDungeonState({
          ...data.state,
          isFinished: true,
          settlement: data.settlement,
        });
      } else if (data.type === 'TRIGGER_BATTLE') {
        // Trigger Battle View
        // setActiveBattleId(data.battleId); // Defer to user confirmation

        const enemyDesc =
          option.costs?.find((c) => c.type === 'battle')?.desc || '强敌';
        setOpponentNameForBattle(enemyDesc);

        // Show confirmation screen
        setPendingBattle({
          id: data.battleId,
          reason: enemyDesc,
        });
      } else {
        setDungeonState(data.state);
        setLastRoundData(data.roundData);
        setSelectedOptionId(null);
      }
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '行动失败',
        tone: 'danger',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading || isCultivatorLoading) {
    return (
      <InkPageShell title="推演中...">
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
    const settlement = dungeonState.settlement;
    return (
      <InkPageShell title="探索结束" backHref="/game">
        <InkCard className="p-4 space-y-4">
          <p className="text-ink/80 leading-relaxed">
            {settlement?.ending_narrative}
          </p>

          <div className="bg-paper-dark p-4 rounded text-center">
            <div className="text-base text-ink-secondary">评价</div>
            <div className="text-4xl text-crimson my-2">
              {settlement?.settlement?.reward_tier}
            </div>
            <div className="text-base text-ink-secondary">获得机缘</div>
          </div>

          {settlement?.settlement &&
            settlement.settlement.potential_items?.length > 0 && (
              <InkList dense>
                {settlement?.settlement?.potential_items?.map(
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

  const handleQuit = () => {
    openDialog({
      title: '放弃探索',
      content:
        '确定要放弃当前探索吗？放弃后无法获得任何奖励，且本轮进度将丢失。',
      confirmLabel: '确认放弃',
      cancelLabel: '取消',
      onConfirm: async () => {
        try {
          setLoading(true);
          const res = await fetch('/api/dungeon/quit', { method: 'POST' });
          if (!res.ok) throw new Error('放弃失败');
          setDungeonState(null);
          setLastRoundData(null);
          pushToast({ message: '已放弃探索', tone: 'success' });
        } catch {
          pushToast({ message: '操作失败', tone: 'danger' });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 神识查探敌人
  const handleProbeEnemy = async () => {
    if (!pendingBattle || !cultivator) return;

    try {
      setIsProbing(true);
      const res = await fetch(
        `/api/dungeon/battle/probe?battleId=${pendingBattle.id}`,
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // 更新 pendingBattle 状态，添加敌人数据
      setPendingBattle((prev) =>
        prev
          ? {
              ...prev,
              enemyData: data.enemy,
            }
          : null,
      );

      setShowEnemyDetails(true);
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '查探失败',
        tone: 'danger',
      });
    } finally {
      setIsProbing(false);
    }
  };

  // 放弃战斗
  const handleAbandonBattle = () => {
    if (!pendingBattle || !cultivator) return;

    openDialog({
      title: '放弃战斗',
      content:
        '确定要放弃此战吗？你将狼狈退出，但不会受伤。放弃后会直接进入副本结算。',
      confirmLabel: '确认放弃',
      cancelLabel: '取消',
      onConfirm: async () => {
        try {
          setLoading(true);
          const res = await fetch('/api/dungeon/battle/abandon', {
            method: 'POST',
            body: JSON.stringify({
              cultivatorId: cultivator.id,
              battleId: pendingBattle.id,
            }),
          });

          const data = await res.json();
          if (data.error) throw new Error(data.error);

          // 进入结算
          setPendingBattle(null);
          setShowEnemyDetails(false);
          setDungeonState({
            ...data.state,
            isFinished: true,
            settlement: data.settlement,
          });

          pushToast({ message: '已放弃战斗', tone: 'success' });
        } catch (e) {
          pushToast({
            message: e instanceof Error ? e.message : '操作失败',
            tone: 'danger',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // --- Battle Logic ---
  const executeDungeonBattle = async (battleId: string) => {
    setIsStreaming(true);
    setStreamingReport('');
    setBattleResult(undefined);
    setBattleEnd(false);

    try {
      const response = await fetch('/api/dungeon/battle/execute', {
        method: 'POST',
        body: JSON.stringify({ cultivatorId: cultivator?.id, battleId }),
      });

      if (!response.ok) throw new Error('Battle connection failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (!reader) throw new Error('No stream');

      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'battle_result') {
                const res = data.data;
                setBattleResult({
                  winner: res.winner,
                  loser: res.loser,
                  log: res.log,
                  turns: res.turns,
                  playerHp: res.playerHp,
                  opponentHp: res.opponentHp,
                  timeline: res.timeline ?? [],
                });
              } else if (data.type === 'chunk') {
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                setIsStreaming(false);
                setStreamingReport(fullReport);
                setBattleEnd(true);

                if (data.isFinished) {
                  // 不立即跳转，保存结算信息等待用户确认
                  setBattleSettlement({
                    isFinished: true,
                    settlement: data.settlement,
                  });
                  // 保持战斗视图，让用户查看战报
                } else {
                  setDungeonState(data.dungeonState);
                  setLastRoundData(data.roundData);
                }
                setSelectedOptionId(null);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Stream parse error', e);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      pushToast({
        message: e instanceof Error ? e.message : '战斗模拟失败',
        tone: 'danger',
      });
      setIsStreaming(false);
      // Fallback?
      setActiveBattleId(null);
    }
  };

  // --- Render Battle View ---
  if (activeBattleId) {
    return (
      <BattlePageLayout
        title={`【激战 · ${dungeonState?.theme || '秘境'}】`}
        backHref="#"
        loading={!battleResult && isStreaming}
        battleResult={battleResult}
        isStreaming={isStreaming}
        actions={{
          primary: {
            label: battleSettlement
              ? '查看结算'
              : battleEnd
                ? '继续探险'
                : '战斗中...',
            onClick: () => {
              if (battleSettlement) {
                // 用户确认查看战报后，跳转到结算页面
                setDungeonState((prev) =>
                  prev
                    ? {
                        ...prev,
                        isFinished: true,
                        settlement: battleSettlement.settlement,
                      }
                    : null,
                );
                setActiveBattleId(null);
                setBattleSettlement(null);
              } else if (battleEnd) {
                setActiveBattleId(null);
              }
            },
            disabled: !battleEnd && !battleSettlement,
          },
        }}
      >
        {/* Timeline */}
        {battleResult?.timeline && battleResult.timeline.length > 0 && (
          <BattleTimelineViewer
            battleResult={battleResult}
            playerName={cultivator!.name}
            opponentName={opponentNameForBattle}
          />
        )}

        {/* Report */}
        <BattleReportViewer
          displayReport={streamingReport}
          isStreaming={isStreaming}
          battleResult={battleResult}
          player={cultivator!}
          isWin={battleResult?.winner.id === cultivator?.id} // Rough check, id might mismatch slightly if not careful
        />
      </BattlePageLayout>
    );
  }

  // Pending Battle Confirmation
  if (pendingBattle) {
    return (
      <InkPageShell title="遭遇战" backHref="#">
        <InkCard className="p-6 space-y-6">
          {/* 顶部：敌人信息 */}
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">⚔️</div>
            <div>
              <h2 className="text-2xl font-bold text-crimson mb-2">遭遇强敌</h2>
              <p className="text-lg text-ink">
                前方发现了{' '}
                <span className="font-bold">{pendingBattle.reason}</span>
              </p>
              <p className="text-sm text-ink-secondary mt-2">
                此战避无可避，当速决断！
              </p>
            </div>
          </div>

          {/* 中部：敌人详情（查探后显示） */}
          {showEnemyDetails && pendingBattle.enemyData && (
            <InkCard className="bg-paper-dark p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                <h3 className="font-bold text-crimson">
                  {pendingBattle.enemyData.name}
                  {pendingBattle.enemyData.title && (
                    <span className="text-sm text-ink-secondary ml-2">
                      ({pendingBattle.enemyData.title})
                    </span>
                  )}
                </h3>
                <InkBadge tier={pendingBattle.enemyData.realm}>
                  {pendingBattle.enemyData.realm_stage}
                </InkBadge>
              </div>

              {/* 五维属性 */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>体魄: {pendingBattle.enemyData.attributes.vitality}</div>
                <div>灵力: {pendingBattle.enemyData.attributes.spirit}</div>
                <div>悟性: {pendingBattle.enemyData.attributes.wisdom}</div>
                <div>速度: {pendingBattle.enemyData.attributes.speed}</div>
                <div className="col-span-2">
                  神识: {pendingBattle.enemyData.attributes.willpower}
                </div>
              </div>

              {/* 灵根 */}
              <LingGenMini
                spiritualRoots={pendingBattle.enemyData.spiritual_roots}
              />

              {/* 技能 */}
              {pendingBattle.enemyData.skills &&
                pendingBattle.enemyData.skills.length > 0 && (
                  <div className="text-sm">
                    <div className="text-ink-secondary mb-1">技能:</div>
                    <div className="space-y-1">
                      {pendingBattle.enemyData.skills.map((skill, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>
                            {skill.name} ({skill.element})
                          </span>
                          <span className="text-ink-secondary">
                            威力:{skill.power}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 描述 */}
              {pendingBattle.enemyData.background && (
                <p className="text-xs text-ink-secondary italic leading-relaxed">
                  {pendingBattle.enemyData.background}
                </p>
              )}
            </InkCard>
          )}

          {/* 底部：操作按钮 */}
          <div className="space-y-3">
            {/* 神识查探按钮 */}
            {!showEnemyDetails && (
              <InkButton
                variant="secondary"
                className="w-full py-3"
                onClick={handleProbeEnemy}
                disabled={isProbing || loading}
              >
                {isProbing ? '查探中...' : '👁️ 神识查探'}
              </InkButton>
            )}

            {/* 开始战斗按钮 */}
            <InkButton
              variant="primary"
              className="w-full py-4 text-lg"
              disabled={loading}
              onClick={async () => {
                const battleId = pendingBattle.id;

                try {
                  // 设置敌人名字用于战斗显示
                  if (pendingBattle.enemyData) {
                    // 已经查探过，直接使用
                    const enemyName = pendingBattle.enemyData.title
                      ? `${pendingBattle.enemyData.title}·${pendingBattle.enemyData.name}`
                      : pendingBattle.enemyData.name;
                    setOpponentNameForBattle(enemyName);
                  } else {
                    // 没有查探过，先获取敌人数据
                    const res = await fetch(
                      `/api/dungeon/battle/probe?battleId=${battleId}`,
                    );
                    const data = await res.json();
                    if (data.enemy) {
                      const enemyName = data.enemy.title
                        ? `${data.enemy.title}·${data.enemy.name}`
                        : data.enemy.name;
                      setOpponentNameForBattle(enemyName);
                    }
                  }
                } catch (e) {
                  // 获取失败则使用默认名字
                  setOpponentNameForBattle(pendingBattle.reason || '神秘敌手');
                }

                setPendingBattle(null);
                setShowEnemyDetails(false);
                setActiveBattleId(battleId);
                executeDungeonBattle(battleId);
              }}
            >
              ⚔️ 开始战斗
            </InkButton>

            {/* 放弃战斗按钮 */}
            <InkButton
              variant="ghost"
              className="w-full py-2 text-ink-secondary hover:text-crimson"
              onClick={handleAbandonBattle}
              disabled={loading}
            >
              🏃 放弃战斗（撤退）
            </InkButton>
          </div>
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
          <div className="flex justify-between items-center  text-ink-secondary px-2 w-full">
            <span>危: {dungeonState.dangerScore ?? 0}</span>
            <InkButton variant="primary" onClick={handleQuit}>
              放弃
            </InkButton>
          </div>
        }
      >
        <InkCard className="mb-6 min-h-[200px] flex flex-col justify-center">
          <p className="leading-relaxed text-ink">
            {lastRoundData.scene_description}
          </p>
        </InkCard>

        <InkSection title="抉择时刻">
          <div className="space-y-3">
            {lastRoundData.interaction.options.map((opt: DungeonOption) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  disabled={processingAction}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`w-full text-left p-4 rounded border transition-all 
                                   ${
                                     isSelected
                                       ? 'border-crimson bg-crimson/5 ring-1 ring-crimson'
                                       : 'border-ink/20 bg-paper hover:border-crimson hover:bg-paper-dark'
                                   }
                                   ${processingAction ? 'opacity-50 cursor-not-allowed' : ''}
                                  `}
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <span
                      className={`font-bold flex-1 leading-tight ${isSelected ? 'text-crimson' : ''}`}
                    >
                      {opt.text}
                    </span>
                    <InkTag
                      tone={
                        opt.risk_level === 'high'
                          ? 'bad'
                          : opt.risk_level === 'medium'
                            ? 'info'
                            : 'good'
                      }
                      variant="outline"
                      className="text-xs shrink-0"
                    >
                      {opt.risk_level === 'high'
                        ? '凶险'
                        : opt.risk_level === 'medium'
                          ? '莫测'
                          : '稳健'}
                    </InkTag>
                  </div>
                  {opt.requirement && (
                    <div className="text-sm text-crimson mt-2">
                      需: {opt.requirement}
                    </div>
                  )}
                  {opt.potential_cost && (
                    <div className="text-sm text-ink-secondary mt-1">
                      代价: {opt.potential_cost}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <InkButton
            variant="primary"
            className="mt-4 mx-auto block!"
            disabled={!selectedOptionId || processingAction}
            onClick={() => {
              const opt = lastRoundData.interaction.options.find(
                (o) => o.id === selectedOptionId,
              );
              if (opt) handleAction(opt);
            }}
          >
            {processingAction ? '推演中...' : '确定抉择'}
          </InkButton>
        </InkSection>

        {dungeonState.history.length > 0 && (
          <InkSection title="回顾前路" subdued>
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
        <InkButton
          href="/game/map"
          className="w-full text-center justify-center py-6 mb-4 border-dashed border-ink/40 hover:border-crimson hover:text-crimson group"
        >
          {`🌍 ${selectedMapNode ? '重新选择' : '选择秘境'}`}
        </InkButton>
        {selectedMapNode && <MapNodeCard node={selectedMapNode} />}
      </InkSection>

      <div className="mt-8">
        <InkButton
          variant="primary"
          className="w-full text-center justify-center py-4 text-lg"
          onClick={handleStart}
          disabled={loading || !selectedMapNode}
        >
          {loading ? '推演中...' : '开启探险'}
        </InkButton>
        <p className="text-center text-xs text-ink-secondary mt-2">
          * 每日仅可探索一次（体验版，不会消耗材料、获得奖励）
        </p>
      </div>
    </InkPageShell>
  );
}

export default function DungeonPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="云游探秘">
          <div className="flex justify-center p-12">
            <p className="animate-pulse">正在加载探索数据...</p>
          </div>
        </InkPageShell>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}

function MapNodeCard({ node }: { node: MapNodeInfo }) {
  return (
    <div
      className={`border rounded transition-all duration-300 border-crimson bg-crimson/5 ring-crimson`}
    >
      <div className="p-3 cursor-pointer">
        <div className="flex justify-between items-start mb-1">
          <h3 className={`font-bold text-crimson`}>{node.name}</h3>
          <span className="text-crimson text-xs">● 已选择</span>
        </div>
        <p className="text-xs text-ink-secondary line-clamp-2 mb-2">
          {node.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {node.tags.slice(0, 3).map((t) => (
            <InkTag
              key={t}
              variant="outline"
              tone="neutral"
              className="text-[10px] py-0"
            >
              {t}
            </InkTag>
          ))}
        </div>
      </div>
    </div>
  );
}
