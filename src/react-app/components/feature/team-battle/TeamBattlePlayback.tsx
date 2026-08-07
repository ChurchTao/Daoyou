import type { TeamBattleRecord } from '@shared/engine/battle-team';
import type { useTeamBattlePlayback } from './useTeamBattlePlayback';

interface TeamBattlePlaybackProps {
  record: TeamBattleRecord;
  playback: ReturnType<typeof useTeamBattlePlayback>;
}

export function TeamBattlePlayback({ record, playback }: TeamBattlePlaybackProps) {
  const totalFrames = record.stateTimeline.frames.length;
  const currentFrameNum = Math.max(0, playback.currentIndex + 1);

  return (
    <div className="border-ink/15 border-dashed border bg-bgpaper/50 flex items-center gap-2 px-4 py-2">
      {/* 播放/暂停 */}
      <button
        onClick={playback.toggle}
        disabled={playback.currentIndex >= totalFrames - 1 && !playback.isPlaying}
        className="text-crimson text-sm hover:text-crimson/70 disabled:text-ink-secondary/40 disabled:cursor-not-allowed"
      >
        {playback.isPlaying ? '「暂停」' : '「播放」'}
      </button>

      {/* 上一步 */}
      <button
        onClick={playback.stepBackward}
        disabled={playback.currentIndex <= 0}
        className="text-ink text-sm hover:text-crimson disabled:text-ink-secondary/40 disabled:cursor-not-allowed"
      >
        「上一步」
      </button>

      {/* 下一步 */}
      <button
        onClick={playback.stepForward}
        disabled={playback.currentIndex >= totalFrames - 1}
        className="text-ink text-sm hover:text-crimson disabled:text-ink-secondary/40 disabled:cursor-not-allowed"
      >
        「下一步」
      </button>

      {/* 重置 */}
      <button
        onClick={playback.reset}
        className="text-ink-secondary text-sm hover:text-crimson"
      >
        「重置」
      </button>

      {/* 进度 */}
      <div className="flex-1">
        <div className="bg-ink/10 h-1.5 w-full overflow-hidden">
          <div
            className="bg-crimson h-full transition-all"
            style={{ width: `${playback.progress * 100}%` }}
          />
        </div>
      </div>

      {/* 进度数字 */}
      <span className="text-ink-secondary font-mono text-xs">
        {currentFrameNum}/{totalFrames}
      </span>

      {/* 速度 */}
      <div className="flex items-center gap-1">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => playback.setSpeed(s)}
            className={[
              'text-xs',
              playback.speed === s
                ? 'text-crimson font-semibold'
                : 'text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            {s}倍
          </button>
        ))}
      </div>
    </div>
  );
}
