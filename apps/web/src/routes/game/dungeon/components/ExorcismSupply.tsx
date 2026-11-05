import { EXORCISM_ENCOUNTER_PACK } from '@daoyou/game-content/dungeon/exorcism';
import type {
  ExorcismRunState,
  ExorcismSupplyChoice,
} from '@daoyou/game-domain/dungeon/exorcism';
import { useState } from 'react';
import { ExorcismPillBar } from './ExorcismPillBar';
import {
  ExorcismMeter,
  ExorcismRuleLine,
  ExorcismTrack,
} from './ExorcismRunStrip';
import {
  EXORCISM_STAGES,
  exorcismProgressGrade,
  exorcismStageEnemies,
  ratioPercent,
} from './exorcismView';

/** 补给点：要血还是要东西。两张卡直接写结果，不写规则。 */
export function ExorcismSupply({
  run,
  processing,
  onSupply,
  onRetreat,
  onRefresh,
}: {
  run: ExorcismRunState;
  processing: boolean;
  onSupply: (choice: ExorcismSupplyChoice) => Promise<void>;
  onRetreat: (title: string, content: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [hovered, setHovered] = useState(false);
  const player = run.resources?.player;
  if (!player) return null;
  const { restHpRatio, restMpRatio } = EXORCISM_ENCOUNTER_PACK.supply;
  const restedHp = Math.min(
    player.maxHp,
    Math.floor(player.hp + player.maxHp * restHpRatio),
  );
  const restedMp = Math.min(
    player.maxMp,
    Math.floor(player.mp + player.maxMp * restMpRatio),
  );
  const hp = ratioPercent(player.hp, player.maxHp);
  const mp = ratioPercent(player.mp, player.maxMp);
  const next = run.wins + 1;
  const grade = exorcismProgressGrade(run.wins);

  return (
    <div className="bg-paper text-ink space-y-5 rounded-lg px-5 py-6 shadow-[inset_0_0_90px_18px_rgba(44,24,16,0.16)] md:px-8 md:py-8">
      <ExorcismTrack run={run} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          第 {run.wins} 战胜了。接下来怎么办？
        </h2>
        <ExorcismMeter
          label="局内气血"
          current={player.hp}
          max={player.maxHp}
          tone="hp"
          preview={hovered ? restedHp : undefined}
        />
        <ExorcismMeter
          label="局内法力"
          current={player.mp}
          max={player.maxMp}
          tone="mp"
          preview={hovered ? restedMp : undefined}
        />
        <ExorcismRuleLine />
        <ExorcismPillBar run={run} processing={processing} onUsed={onRefresh} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={processing}
          className="border-ink/40 hover:bg-ink/5 rounded-md border bg-white/30 px-4 py-4 text-left transition-colors disabled:opacity-50"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onClick={() => void onSupply('rest')}
        >
          <div className="text-lg font-semibold">调息</div>
          <div className="text-ink/80 mt-1 text-sm leading-7">
            气血 <span className="font-mono">{hp}%</span> →{' '}
            <span className="font-mono">
              {ratioPercent(restedHp, player.maxHp)}%
            </span>
            ，法力 <span className="font-mono">{mp}%</span> →{' '}
            <span className="font-mono">
              {ratioPercent(restedMp, player.maxMp)}%
            </span>
            。存活的灵兽同样恢复。
          </div>
        </button>
        <button
          type="button"
          disabled={processing}
          className="border-crimson/60 bg-crimson/5 hover:bg-crimson/10 flex flex-col justify-start rounded-md border px-4 py-4 text-left transition-colors disabled:opacity-50"
          onClick={() => void onSupply('search')}
        >
          <div className="text-crimson text-lg font-semibold">搜寻</div>
          <div className="text-ink/80 mt-1 text-sm leading-7">
            多拿一次奖励。状态不变，气血仍为{' '}
            <span className="font-mono">{hp}%</span>。
          </div>
        </button>
      </div>

      <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
        <div className="text-sm">
          <span className="text-ink-secondary">
            下一场：第 {next} 战 · {EXORCISM_STAGES[next - 1]}
          </span>
          <span className="ml-2 font-semibold">
            {exorcismStageEnemies(run, next).join('、')}
          </span>
        </div>
        <button
          type="button"
          disabled={processing}
          className="text-ink-secondary hover:text-ink text-sm underline underline-offset-4 disabled:opacity-50"
          onClick={() =>
            void onRetreat(
              '就此收手',
              `现在结算，评级 ${grade}，不打折。已得的奖励全部带走。`,
            )
          }
        >
          就此收手，现在结算（评级 {grade}）
        </button>
      </div>
    </div>
  );
}
