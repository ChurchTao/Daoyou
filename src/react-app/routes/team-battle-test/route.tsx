import { useState, useCallback } from 'react';
import type { TeamBattleRecord } from '@shared/engine/battle-team';
import type { TeamBattleTestResponse } from '@shared/contracts/teamBattleTest';
import { TeamBattleControls, type TeamBattlePreset } from '@app/components/feature/team-battle/TeamBattleControls';
import { TeamBattleArena } from '@app/components/feature/team-battle/TeamBattleArena';
import { TeamBattlePlayback } from '@app/components/feature/team-battle/TeamBattlePlayback';
import { TeamBattleLog } from '@app/components/feature/team-battle/TeamBattleLog';
import { TeamBattleRoster } from '@app/components/feature/team-battle/TeamBattleRoster';
import { TeamBattleStats } from '@app/components/feature/team-battle/TeamBattleStats';
import { useTeamBattlePlayback } from '@app/components/feature/team-battle/useTeamBattlePlayback';

/**
 * 战斗结果区域。
 * 用 key={runId} 在每次开战时重新挂载，自动重置 playback 状态。
 */
function TeamBattleResult({ record }: { record: TeamBattleRecord }) {
  const playback = useTeamBattlePlayback(record);

  const currentSeq = playback.currentFrame?.seq ?? -1;
  const totalFrames = record.stateTimeline.frames.length;

  return (
    <div className="space-y-4">
      <TeamBattleArena
        record={record}
        frame={playback.currentFrame}
        currentEventSeq={currentSeq}
      />
      <TeamBattlePlayback record={record} playback={playback} />
      <TeamBattleLog record={record} currentSeq={currentSeq} />

      {playback.currentIndex >= totalFrames - 1 && (
        <div className="border-crimson/30 border-l-2 border-l-crimson bg-crimson/5 p-4 text-center">
          <span className="text-lg font-heading text-crimson">
            {record.outcome.winningTeam
              ? `${record.outcome.winningTeam} 队获胜！`
              : '双方平局'}
          </span>
          <span className="text-ink-secondary ml-3 text-sm">
            共 {record.outcome.turns} 回合
            {record.outcome.reachedMaxTurns ? '（回合上限）' : ''}
          </span>
        </div>
      )}

      {/* 战后统计：回合伤害/治疗曲线，可切换纵轴 */}
      <TeamBattleStats record={record} />
    </div>
  );
}

export default function TeamBattleTestPage() {
  const [record, setRecord] = useState<TeamBattleRecord | null>(null);
  const [runId, setRunId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<TeamBattlePreset>('library5v5');

  const handleRun = useCallback(async (opts: { seed?: string; maxTurns?: number; preset?: TeamBattlePreset }) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/team-battle-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${resp.status}`);
      }
      const data: TeamBattleTestResponse = await resp.json();
      setRecord(data.data);
      setRunId((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const is5v5 = preset === 'library5v5';

  return (
    <div className="bg-paper text-ink min-h-screen">
      <div className="mx-auto max-w-5xl px-4 pt-8 pb-12">
        <header className="mb-6 text-center">
          <h1 className="text-crimson font-heading text-3xl">
            {is5v5 ? '五五演武' : '二二演武'}
          </h1>
          <p className="text-ink-secondary mt-1 text-sm">
            多人战斗引擎验证 · 阵型站位 · 光环/追击/蓄力/嘲讽 · 去法力系统
            {is5v5 && ' · 十角色不对称阵容'}
          </p>
        </header>

        <div className="mb-6">
          <TeamBattleControls
            onRun={handleRun}
            loading={loading}
            preset={preset}
            onPresetChange={setPreset}
          />
        </div>

        {/* 5v5 阵容一览：开战前即可查看角色属性与技能说明 */}
        {is5v5 && (
          <div className="mb-6">
            <TeamBattleRoster />
          </div>
        )}

        {error && (
          <div className="border-crimson/30 border-dashed border bg-crimson/5 mb-4 p-3 text-sm text-crimson">
            「 error 」 {error}
          </div>
        )}

        {record && (
          <TeamBattleResult key={runId} record={record} />
        )}

        {!record && !loading && !error && (
          <div className="border-ink/15 border-dashed border bg-bgpaper/50 flex flex-col items-center justify-center py-20">
            <span className="text-ink-secondary">
              {is5v5 ? '查看上方阵容后点击「开战」开始演武' : '点击「开战」开始演武'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
