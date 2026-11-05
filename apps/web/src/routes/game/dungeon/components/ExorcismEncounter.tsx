import { InkButton } from '@app/components/ui/InkButton';
import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
} from '@daoyou/game-content/dungeon/exorcism';
import type { DungeonEncounterView } from '@daoyou/game-domain/dungeon';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { useCallback, useState } from 'react';
import { ExorcismPillBar } from './ExorcismPillBar';
import { ExorcismMeter } from './ExorcismRunStrip';
import { ExorcismStage } from './ExorcismStage';
import {
  EXORCISM_STAGES,
  exorcismProgressGrade,
  exorcismStageFoes,
} from './exorcismView';
import './mystery-scenes.css';
import { MysteryReveal } from './MysteryAtmosphere';
import { MysteryPortrait } from './MysteryPortrait';

function CounterMark() {
  return (
    <span
      className="border-crimson text-crimson font-heading shrink-0 -rotate-6 border-2 px-2 py-0.5 text-sm"
      aria-label="这位祟主克制你的构筑"
    >
      克星
    </span>
  );
}

/**
 * 每一场的迎战页：右边是这一场的对手，左边是自己的状态和丹药。
 * 开局这一页就是祟主现形：灵气已扣，首领不能重抽，玩家要看到它的机制和
 * 是否克制自己。开局和首领战各播一次转场。
 */
export function ExorcismEncounter({
  run,
  encounter,
  location,
  scene,
  processing,
  onBegin,
  onRetreat,
  onRefresh,
}: {
  run: ExorcismRunState;
  encounter: DungeonEncounterView;
  location: string;
  scene?: string;
  processing: boolean;
  onBegin: () => Promise<void>;
  onRetreat: (title: string, content: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const boss = EXORCISM_BOSSES[run.bossId];
  const opening = run.wins === 0;
  const bossStage = run.wins === 3;
  const [revealed, setRevealed] = useState(!opening && !bossStage);
  const reveal = useCallback(() => setRevealed(true), []);
  const grade = exorcismProgressGrade(run.wins);
  const stage = EXORCISM_STAGES[run.wins];
  const defs = exorcismStageFoes(run, run.wins + 1);
  const foes = encounter.enemies.map((name) => ({
    name,
    portrait: defs.find((def) => def.name === name)?.portrait,
  }));
  const counterLine = run.countered
    ? `${boss.counterLine}打赢它能多掷一次额外奖励。`
    : null;

  return (
    <ExorcismStage location={location} scene={scene} run={run}>
      {revealed ? null : (
        <MysteryReveal
          surface="paper"
          eyebrow={opening ? '祟主现形' : '祟主现身'}
          name={boss.name}
          description={boss.mechanic}
          portrait={boss.portrait}
          onDone={reveal}
        />
      )}

      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section
          aria-label={`第 ${run.wins + 1} 战的对手`}
          className="min-w-0 lg:order-2"
        >
          <div className="text-ink-secondary text-sm">
            第 {run.wins + 1} 战 · {stage}
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-center gap-x-8 gap-y-3 lg:justify-start">
            {foes.map((foe) => (
              <div key={foe.name} className="flex flex-col items-center gap-2">
                <MysteryPortrait
                  portrait={foe.portrait}
                  name={foe.name}
                  size={foes.length === 1 ? 'xl' : 'lg'}
                />
                <h2
                  className={
                    bossStage
                      ? 'font-heading text-crimson text-3xl md:text-4xl'
                      : 'font-heading text-2xl md:text-3xl'
                  }
                >
                  {foe.name}
                </h2>
              </div>
            ))}
            {bossStage && run.countered ? <CounterMark /> : null}
          </div>
          <p className="text-ink/85 mt-3 max-w-2xl text-sm leading-7">
            {bossStage ? boss.mechanic : encounter.description}
          </p>
          {bossStage && counterLine ? (
            <p className="text-crimson max-w-2xl text-sm leading-7">
              {counterLine}
            </p>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-5 lg:order-1">
          {bossStage ? null : (
            <section aria-label="本局祟主" className="flex items-start gap-3">
              <MysteryPortrait
                portrait={boss.portrait}
                name={boss.name}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-ink-secondary text-xs">本局祟主</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-crimson text-xl">
                    {boss.name}
                  </span>
                  {run.countered ? <CounterMark /> : null}
                </div>
                <p className="text-ink-secondary mt-1 text-xs leading-5">
                  {boss.mechanic}
                </p>
                {counterLine ? (
                  <p className="text-crimson mt-1 text-xs leading-5">
                    {counterLine}
                  </p>
                ) : null}
              </div>
            </section>
          )}
          <div className="space-y-3">
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
          </div>
          <ExorcismPillBar
            run={run}
            processing={processing}
            onUsed={onRefresh}
          />
        </aside>
      </div>

      {/* 窄屏吸底：对手和状态较长，开打不用先翻到页尾。 */}
      <footer className="max-lg:bg-sheet max-lg:border-battle-rule-strong flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-2 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-3 max-lg:border-t max-lg:border-dashed max-lg:px-3 max-lg:pb-3">
        <InkButton
          variant="primary"
          pending={processing}
          onClick={() => void onBegin()}
        >
          迎战
        </InkButton>
        <p className="text-ink/75 min-w-0 text-sm leading-6 max-lg:order-last max-lg:basis-full max-lg:text-xs max-lg:leading-5 lg:flex-1">
          {bossStage
            ? `祟气弥漫，治疗效果降低。胜后气血不低于 ${Math.round(EXORCISM_ENCOUNTER_PACK.grading.sHpRatio * 100)}% 评 S，否则评 A。败了按 B 结算并打折。`
            : '胜则继续，败则按当前进度结算并打折。'}
        </p>
        <button
          type="button"
          disabled={processing}
          className="text-ink-secondary hover:text-ink text-sm underline underline-offset-4 disabled:opacity-50"
          onClick={() =>
            void onRetreat(
              '就此收手',
              grade
                ? `现在结算，评级 ${grade}，不打折。已得的奖励全部带走。`
                : '还没有胜场，现在离开没有奖励，灵气也不退还。',
            )
          }
        >
          {grade ? `就此收手（评级 ${grade}）` : '就此收手（没有奖励）'}
        </button>
      </footer>
    </ExorcismStage>
  );
}
