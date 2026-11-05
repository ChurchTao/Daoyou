import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { EXORCISM_ENCOUNTER_PACK } from '@daoyou/game-content/dungeon/exorcism';
import type {
  ExorcismRunState,
  ExorcismSupplyChoice,
} from '@daoyou/game-domain/dungeon/exorcism';
import { useState } from 'react';
import { ExorcismPillBar } from './ExorcismPillBar';
import { ExorcismMeter } from './ExorcismRunStrip';
import { ExorcismStage } from './ExorcismStage';
import {
  EXORCISM_STAGES,
  exorcismProgressGrade,
  exorcismStageFoes,
  ratioPercent,
} from './exorcismView';
import { MysteryPortrait } from './MysteryPortrait';

/** 补给点：要血还是要东西。两条路直接写结果，不写规则。 */
export function ExorcismSupply({
  run,
  location,
  scene,
  processing,
  onSupply,
  onRetreat,
  onRefresh,
}: {
  run: ExorcismRunState;
  location: string;
  scene?: string;
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
    <ExorcismStage location={location} scene={scene} run={run}>
      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5">
          <div className="space-y-3">
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
          </div>
          <ExorcismPillBar
            run={run}
            processing={processing}
            onUsed={onRefresh}
          />
        </aside>

        <section className="min-w-0 space-y-5">
          <h2 className="font-heading text-2xl md:text-3xl">
            第 {run.wins} 战告捷，接下来怎么办？
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {/* 悬停或聚焦调息时，左侧状态条预览恢复后的数值。 */}
            <div
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setHovered(true)}
              onBlur={() => setHovered(false)}
            >
              <InkChoiceButton
                layout="card"
                className="h-full"
                disabled={processing}
                onClick={() => void onSupply('rest')}
              >
                <div className="font-semibold">调息</div>
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
              </InkChoiceButton>
            </div>
            <InkChoiceButton
              layout="card"
              className="h-full"
              disabled={processing}
              onClick={() => void onSupply('search')}
            >
              <div className="text-crimson font-semibold">搜寻</div>
              <div className="text-ink/80 mt-1 text-sm leading-7">
                多拿一次奖励。状态不变，气血仍为{' '}
                <span className="font-mono">{hp}%</span>。
              </div>
            </InkChoiceButton>
          </div>

          <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <span className="text-ink-secondary shrink-0">
                下一场：第 {next} 战 · {EXORCISM_STAGES[next - 1]}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {exorcismStageFoes(run, next).map((foe) => (
                  <span
                    key={foe.name}
                    className="flex items-center gap-1 font-semibold"
                  >
                    <MysteryPortrait
                      portrait={foe.portrait}
                      name={foe.name}
                      size="sm"
                    />
                    {foe.name}
                  </span>
                ))}
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
              就此收手（评级 {grade}）
            </button>
          </div>
        </section>
      </div>
    </ExorcismStage>
  );
}
