import type { BattleEngineResult } from '@/engine/battleEngine';
import { StatusEffect } from '@/types/constants';
import { getStatusLabel } from '@/types/dictionaries';
import { useEffect, useState } from 'react';

interface BattleTimelineViewerProps {
  battleResult: BattleEngineResult;
  playerName: string;
  opponentName: string;
}

/**
 * 战斗回放组件：显示回合、HP/MP、状态
 */
export function BattleTimelineViewer({
  battleResult,
  playerName,
  opponentName,
}: BattleTimelineViewerProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [autoPlayTurn, setAutoPlayTurn] = useState(true);

  const timeline = battleResult.timeline ?? [];
  const totalTurns = timeline.length;

  // 战斗结果到达后，重置回合播放
  useEffect(() => {
    if (timeline.length > 0) {
      // 使用 setTimeout 确保在组件渲染完成后执行
      setTimeout(() => {
        setCurrentTurnIndex(0);
        setAutoPlayTurn(true);
      }, 0);
    }
  }, [timeline.length]);

  // 回合自动播放
  useEffect(() => {
    if (!autoPlayTurn || timeline.length === 0) return;

    const timer = setInterval(() => {
      setCurrentTurnIndex((idx) => {
        if (idx >= totalTurns - 1) return idx;
        return idx + 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [autoPlayTurn, timeline.length, totalTurns]);

  if (timeline.length === 0) {
    return null;
  }

  const first = timeline[0];
  const maxPlayerHp = first?.player.hp || 1;
  const maxOpponentHp = first?.opponent.hp || 1;
  const maxPlayerMp = first?.player.mp || 1;
  const maxOpponentMp = first?.opponent.mp || 1;
  const safeIndex = Math.min(Math.max(currentTurnIndex, 0), totalTurns - 1);
  const snap = timeline[safeIndex];

  const renderStatusList = (statuses: StatusEffect[]) =>
    statuses.length ? statuses.map((s) => getStatusLabel(s)).join('、') : '无';

  return (
    <div className="mb-8 p-4">
      {/* 顶部：回合信息 + 播放控制 */}
      <div className="mb-2 flex items-center justify-between text-sm text-ink/80">
        <span className="tracking-wide">
          {snap.turn === 0
            ? '[战前状态]'
            : `回合: ${snap.turn} / ${battleResult.turns ?? snap.turn}`}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-ink/60 hover:text-ink"
            onClick={() => {
              setAutoPlayTurn(false);
              setCurrentTurnIndex((idx) => Math.max(0, idx - 1));
            }}
          >
            ‹ 上一回合
          </button>
          <button
            type="button"
            className="text-ink/60 hover:text-ink"
            onClick={() => setAutoPlayTurn((v) => !v)}
          >
            {autoPlayTurn ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button
            type="button"
            className="text-ink/60 hover:text-ink"
            onClick={() => {
              setAutoPlayTurn(false);
              setCurrentTurnIndex((idx) => Math.min(totalTurns - 1, idx + 1));
            }}
          >
            下一回合 ›
          </button>
        </div>
      </div>

      {/* 中部：左右文字排版展示双方数值与状态 */}
      <div className="mt-2 border-t border-dashed border-ink/20 pt-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          {/* 左侧：玩家 */}
          <div className="flex-1 leading-relaxed">
            <div className="mb-1 font-semibold text-ink">{playerName}</div>
            <div className="mb-0.5 text-ink/80">
              气血：{snap.player.hp}/{maxPlayerHp}
            </div>
            <div className="mb-0.5 text-ink/80">
              灵力：{snap.player.mp}/{maxPlayerMp}
            </div>
            <div className="text-ink/70">
              状态：{renderStatusList(snap.player.statuses)}
            </div>
          </div>

          {/* 右侧：对手 */}
          <div className="flex-1 text-right leading-relaxed">
            <div className="mb-1 font-semibold text-ink">{opponentName}</div>
            <div className="mb-0.5 text-ink/80">
              气血：{snap.opponent.hp}/{maxOpponentHp}
            </div>
            <div className="mb-0.5 text-ink/80">
              灵力：{snap.opponent.mp}/{maxOpponentMp}
            </div>
            <div className="text-ink/70">
              状态：{renderStatusList(snap.opponent.statuses)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
