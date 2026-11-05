import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
} from '@daoyou/game-content/dungeon/exorcism';
import type { DungeonEncounterView } from '@daoyou/game-domain/dungeon';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { useCallback, useState } from 'react';
import {
  ExorcismMeter,
  ExorcismRuleLine,
  ExorcismTrack,
} from './ExorcismRunStrip';
import { EXORCISM_STAGES, exorcismProgressGrade } from './exorcismView';
import './mystery-scenes.css';
import { MysteryReveal } from './MysteryAtmosphere';
import { MysteryPortrait } from './MysteryPortrait';

/**
 * 每一场的迎战页。开局这一页就是祟主现形：灵气已扣，首领不能重抽，
 * 玩家在这里看到它的机制和是否克制自己。开局和首领战各播一次转场。
 */
export function ExorcismEncounter({
  run,
  encounter,
  processing,
  onBegin,
  onRetreat,
}: {
  run: ExorcismRunState;
  encounter: DungeonEncounterView;
  processing: boolean;
  onBegin: () => Promise<void>;
  onRetreat: (title: string, content: string) => Promise<void>;
}) {
  const boss = EXORCISM_BOSSES[run.bossId];
  const opening = run.wins === 0;
  const bossStage = run.wins === 3;
  const [revealed, setRevealed] = useState(!opening && !bossStage);
  const reveal = useCallback(() => setRevealed(true), []);
  const grade = exorcismProgressGrade(run.wins);
  const stage = EXORCISM_STAGES[run.wins];

  return (
    <div className="bg-paper text-ink relative space-y-5 overflow-hidden rounded-lg px-5 py-6 shadow-[inset_0_0_90px_18px_rgba(44,24,16,0.22)] md:px-8 md:py-8">
      {revealed ? null : (
        <MysteryReveal
          eyebrow={opening ? '祟主现形' : '祟主当前'}
          name={boss.name}
          description={boss.mechanic}
          portrait={boss.portrait}
          onDone={reveal}
        />
      )}

      <ExorcismTrack run={run} />

      <div className="flex items-center gap-4">
        <MysteryPortrait portrait={boss.portrait} name={boss.name} size="lg" />
        <div className="min-w-0 space-y-2">
          <div className="text-ink-secondary text-xs tracking-[0.3em]">
            本局祟主
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-crimson text-2xl font-semibold tracking-[0.15em] md:text-3xl">
              {boss.name}
            </h2>
            {run.countered ? (
              <span
                className="border-crimson text-crimson -rotate-6 border-2 px-2 py-0.5 text-sm font-semibold"
                aria-label="这位祟主克制你的构筑"
              >
                克星
              </span>
            ) : null}
          </div>
          <p className="text-ink/80 text-sm leading-7">{boss.mechanic}</p>
          {run.countered ? (
            <p className="text-crimson text-sm leading-7">
              {boss.counterLine}打赢它能多掷一次额外奖励。
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-ink/15 space-y-3 border-t border-dashed pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-semibold">
            第 {run.wins + 1} 战 · {stage}
          </div>
          <div className="text-ink-secondary text-sm">
            {encounter.enemies.join('、')}
          </div>
        </div>
        <p className="text-ink/80 text-sm leading-7">{encounter.description}</p>
        <ExorcismMeter
          label="局内气血"
          current={encounter.hp.current}
          max={encounter.hp.max}
          tone="hp"
        />
        <ExorcismMeter
          label="局内法力"
          current={encounter.mp.current}
          max={encounter.mp.max}
          tone="mp"
        />
        <ExorcismRuleLine />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={processing}
          className="border-crimson bg-crimson/5 hover:bg-crimson/10 rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-50"
          onClick={() => void onBegin()}
        >
          <div className="text-crimson font-semibold">
            {processing ? '处理中…' : '迎战'}
          </div>
          <div className="text-ink/75 mt-1 text-sm leading-6">
            {bossStage
              ? `祟气弥漫，治疗效果降低。胜后气血不低于 ${Math.round(EXORCISM_ENCOUNTER_PACK.grading.sHpRatio * 100)}% 评 S，否则评 A。败了按 B 结算并打折。`
              : '胜则继续，败则按当前进度结算并打折。'}
          </div>
        </button>
        <button
          type="button"
          disabled={processing}
          className="border-ink/30 hover:bg-ink/5 flex flex-col justify-start rounded-md border bg-white/30 px-4 py-3 text-left transition-colors disabled:opacity-50"
          onClick={() =>
            void onRetreat(
              '就此收手',
              grade
                ? `现在结算，评级 ${grade}，不打折。已得的奖励全部带走。`
                : '还没有胜场，现在离开没有奖励，灵气也不退还。',
            )
          }
        >
          <div className="font-semibold">就此收手</div>
          <div className="text-ink-secondary mt-1 text-sm leading-6">
            {grade
              ? `现在结算，评级 ${grade}，不打折。`
              : '没有奖励，灵气不退。'}
          </div>
        </button>
      </div>
    </div>
  );
}
