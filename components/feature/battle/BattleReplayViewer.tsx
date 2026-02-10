'use client';

import type { TurnSnapshot } from '@/engine/battle';
import { useState } from 'react';

type Props = {
  playerName: string;
  opponentName: string;
  timeline: TurnSnapshot[];
  battleReport?: string | null;
  turns?: number;
  isWin: boolean;
};

export function BattleReplayViewer({
  playerName,
  opponentName,
  timeline,
  battleReport,
  turns,
  isWin,
}: Props) {
  const total = timeline.length;
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);

  if (!timeline.length) {
    return (
      <div className="text-ink-secondary text-sm">
        暂无详细数值时间线，仅可查看战报文本。
        {battleReport && (
          <div className="text-ink mt-4 whitespace-pre-line">
            {battleReport}
          </div>
        )}
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(currentTurnIndex, 0), total - 1);
  const snap = timeline[safeIndex];
  const first = timeline[0] ?? snap;

  const maxPlayerHp = first?.player.hp || 1;
  const maxOpponentHp = first?.opponent.hp || 1;
  const maxPlayerMp = first?.player.mp || 1;
  const maxOpponentMp = first?.opponent.mp || 1;

  const renderBuffList = (buffs: string[] | undefined) =>
    buffs?.length ? buffs.join('、') : '无';

  return (
    <div>
      {/* 回合信息与控制 */}
      <div className="text-ink/80 mb-3 flex items-center justify-between text-sm">
        <span>
          {snap.turn === 0
            ? '[战前状态]'
            : `回合: ${snap.turn} / ${turns ?? snap.turn}`}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-ink/60 hover:text-ink"
            onClick={() => setCurrentTurnIndex((idx) => Math.max(0, idx - 1))}
          >
            ‹ 上一回合
          </button>
          <button
            type="button"
            className="text-ink/60 hover:text-ink"
            onClick={() =>
              setCurrentTurnIndex((idx) => Math.min(total - 1, idx + 1))
            }
          >
            下一回合 ›
          </button>
        </div>
      </div>

      {/* 数值状态展示 */}
      <div className="border-ink/20 mb-6 border-t border-dashed pt-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 leading-relaxed">
            <div className="text-ink mb-1 font-semibold">{playerName}</div>
            <div className="text-ink/80 mb-0.5">
              气血：{snap.player.hp}/{maxPlayerHp}
            </div>
            <div className="text-ink/80 mb-0.5">
              灵力：{snap.player.mp}/{maxPlayerMp}
            </div>
            <div className="text-ink/70">
              状态：{renderBuffList(snap.player.buffs)}
            </div>
          </div>

          <div className="flex-1 text-right leading-relaxed">
            <div className="text-ink mb-1 font-semibold">{opponentName}</div>
            <div className="text-ink/80 mb-0.5">
              气血：{snap.opponent.hp}/{maxOpponentHp}
            </div>
            <div className="text-ink/80 mb-0.5">
              灵力：{snap.opponent.mp}/{maxOpponentMp}
            </div>
            <div className="text-ink/70">
              状态：{renderBuffList(snap.opponent.buffs)}
            </div>
          </div>
        </div>
      </div>

      {/* 文本战报 */}
      {battleReport && (
        <div className="battle-report mt-2 mb-4">
          {battleReport
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, idx) => (
              <p key={idx} className="text-ink mb-3 whitespace-pre-line">
                <span dangerouslySetInnerHTML={{ __html: line }} />
              </p>
            ))}
        </div>
      )}

      {/* 胜负提示 */}
      <div className="mt-4 text-center">
        <p
          className={`text-lg font-semibold ${
            isWin ? 'text-crimson' : 'text-ink/70'
          }`}
        >
          最终，{playerName} {isWin ? '获胜！' : '败北。'}
        </p>
      </div>
    </div>
  );
}
