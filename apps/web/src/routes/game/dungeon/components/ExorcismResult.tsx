import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@app/lib/cn';
import { EXORCISM_BOSSES } from '@daoyou/game-content/dungeon/exorcism';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { ExorcismTrack } from './ExorcismRunStrip';
import { EXORCISM_STAGES } from './exorcismView';
import { MysteryPortrait } from './MysteryPortrait';

const TITLES: Record<string, string> = {
  S: '斩祟而归',
  A: '险胜祟主',
  B: '止步祟主之前',
  C: '半途而返',
  D: '初战即退',
};

/** 除祟结算的抬头：大评级印章、祟主、走到哪一步。一场未胜不评级。 */
export function ExorcismResult({
  run,
  tags,
}: {
  run: ExorcismRunState;
  tags: string[];
}) {
  const boss = EXORCISM_BOSSES[run.bossId];
  const grade = run.grade ?? null;
  const percent =
    run.finalHpRatio === undefined ? null : Math.floor(run.finalHpRatio * 100);
  const reached =
    run.endReason === 'cleared'
      ? `击败了${boss.name}，结束时气血 ${percent ?? 0}%。`
      : run.endReason === 'retreated'
        ? run.wins > 0
          ? `打完${EXORCISM_STAGES[run.wins - 1]}后主动收手，结算不打折。`
          : '还没有胜场就离开了，这一局没有奖励。'
        : run.wins > 0
          ? `倒在第 ${run.wins + 1} 战 · ${EXORCISM_STAGES[run.wins]}，结算奖励打八折，已得的奖励不收回。`
          : '第一战就败退了，这一局没有奖励。';
  return (
    <div className="border-battle-rule-strong space-y-4 border-b border-dashed pb-5">
      <div className="flex items-center gap-4">
        <div
          aria-label={grade ? `评级 ${grade}` : '未成'}
          className={cn(
            'font-heading flex size-24 shrink-0 -rotate-6 items-center justify-center border-4',
            grade === 'S'
              ? 'border-crimson text-crimson text-6xl'
              : grade
                ? 'border-ink/60 text-ink/80 text-5xl'
                : 'border-ink/30 text-ink/50 text-2xl',
          )}
        >
          {grade ?? '未成'}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-heading text-3xl">
            {grade ? TITLES[grade] : '败退而回'}
          </div>
          <p className="text-ink/80 text-sm leading-6">{reached}</p>
          <div className="space-x-1">
            {tags.map((tag) => (
              <InkTag key={tag} variant="outline">
                {tag}
              </InkTag>
            ))}
          </div>
        </div>
        <div className="hidden sm:block">
          <MysteryPortrait
            portrait={boss.portrait}
            name={boss.name}
            size="md"
            muted={run.endReason === 'cleared'}
          />
        </div>
      </div>
      <ExorcismTrack run={run} finished />
    </div>
  );
}
