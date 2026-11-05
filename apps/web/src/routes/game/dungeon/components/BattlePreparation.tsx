import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import type { DungeonEncounterView } from '@daoyou/game-domain/dungeon';
import { useCallback, useState } from 'react';
import './mystery-scenes.css';
import { mysteryPortraitIcon } from './mysteryArt';
import { MysteryReveal } from './MysteryAtmosphere';

type Mode = 'finale' | 'guard' | undefined;

const COPY: Record<
  'finale' | 'guard' | 'other',
  {
    label: string;
    fight: string;
    retreat: string;
    retreatNote: string;
  }
> = {
  finale: {
    label: '结尾对决 · 首领',
    fight: '胜：擒下对手，拿到对决分。败：推理所得照常结算。',
    retreat: '任其遁走',
    retreatNote: '不打这一仗，推理所得照常结算，只是拿不到对决分。',
  },
  guard: {
    label: '守卫 · 精英',
    fight: '胜则闯入；败则退回原处。两者都耗 1 点行动力。',
    retreat: '暂且退回',
    retreatNote: '回到调查，另寻化解之法，不耗行动力。',
  },
  other: {
    label: '前方守敌',
    fight: '胜则继续前行。',
    retreat: '结束探索',
    retreatNote: '带走此前已确定的收获。',
  },
};

function Meter({
  label,
  current,
  max,
  tone,
}: {
  label: string;
  current: number;
  max: number;
  tone: 'hp' | 'mp';
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono">
          {Math.floor(current)} / {Math.floor(max)}
        </span>
      </div>
      <div className="bg-ink/10 mt-1 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700',
            tone === 'hp' ? 'bg-crimson' : 'bg-[#5d7380]',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 迎战准备：纸面上敌我对峙，四周淡墨晕染收紧气氛。对手立绘、身份与情状在一侧，
 * 你的气血、法力与出战灵兽在另一侧，中间以马善政字体的 VS 分隔；
 * 选择写成两张后果卡，说明打与不打各会怎样。结尾对决先播一段“现形”转场。
 */
export function BattlePreparation({
  encounter,
  processing,
  onBegin,
  onQuit,
  mode,
  portrait,
}: {
  encounter: DungeonEncounterView;
  processing: boolean;
  /**
   * 解谜中的遭遇战：finale 为结案后的对决，放弃即任其遁走、仍按结案结算；
   * guard 为强闯守卫，放弃即退回调查。
   */
  mode?: Mode;
  /** 对手的立绘键。 */
  portrait?: string;
  onBegin: () => Promise<void>;
  onQuit: () => Promise<boolean>;
}) {
  const [revealed, setRevealed] = useState(mode !== 'finale');
  const reveal = useCallback(() => setRevealed(true), []);
  const copy = COPY[mode ?? 'other'];
  const foeIcon = mysteryPortraitIcon(portrait);
  const foeName = encounter.enemies.join('、');
  const lowHp =
    encounter.hp.max > 0 && encounter.hp.current / encounter.hp.max < 0.3;

  return (
    <div className="bg-paper text-ink relative overflow-hidden rounded-lg px-5 py-6 shadow-[inset_0_0_70px_12px_rgba(44,24,16,0.14)] md:px-8 md:py-8">
      {revealed ? null : (
        <MysteryReveal
          name={foeName}
          description={encounter.description}
          portrait={portrait}
          onDone={reveal}
        />
      )}
      <div className="text-ink-secondary text-xs tracking-[0.3em]">
        {copy.label}
      </div>

      <div className="mt-5 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-8">
        <div className="mystery-duel-foe space-y-3">
          <div className="flex flex-col items-center gap-3 text-center md:flex-row md:text-left">
            <div className="flex size-32 shrink-0 items-center justify-center md:size-36">
              {foeIcon ? (
                <GameIcon
                  value={foeIcon}
                  purpose="artwork"
                  className="size-full"
                />
              ) : (
                <span className="text-ink/40 text-6xl">
                  {foeName.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="text-crimson text-2xl font-semibold tracking-[0.2em] md:text-3xl">
              {foeName}
            </div>
          </div>
          <p className="text-ink/80 text-center text-sm leading-7 md:text-left">
            {encounter.description}
          </p>
        </div>

        {/* 敌我之间以书法 VS 分隔，窄屏上下排列时仍居中显示。 */}
        <div
          aria-hidden
          className="mystery-duel-vs font-heading text-ink/75 justify-self-center text-5xl leading-none select-none md:text-6xl"
        >
          VS
        </div>

        <div className="mystery-duel-self space-y-3">
          <div className="flex items-center gap-3">
            <div className="border-ink/30 flex size-10 items-center justify-center rounded-full border text-sm">
              你
            </div>
            <div className="text-ink-secondary text-xs">
              出战灵兽：{encounter.beast ?? '无'}
            </div>
          </div>
          <Meter
            label="气血"
            current={encounter.hp.current}
            max={encounter.hp.max}
            tone="hp"
          />
          <Meter
            label="法力"
            current={encounter.mp.current}
            max={encounter.mp.max}
            tone="mp"
          />
          <p
            className={cn(
              'text-xs leading-6',
              lowHp ? 'text-crimson' : 'text-ink-secondary',
            )}
          >
            {lowHp
              ? '气血不足三成，慎战。'
              : '以当前气血、法力入场，战斗消耗会保留。'}
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={processing}
          className="border-crimson bg-crimson/5 hover:bg-crimson/10 rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-50"
          onClick={() => void onBegin()}
        >
          <div className="text-crimson font-semibold">
            {processing ? '处理中…' : '迎战'}
          </div>
          <div className="text-ink/75 mt-1 text-sm leading-6">{copy.fight}</div>
        </button>
        <button
          type="button"
          disabled={processing}
          className="border-ink/30 hover:bg-ink/5 rounded-md border bg-white/30 px-4 py-3 text-left transition-colors disabled:opacity-50"
          onClick={() => void onQuit()}
        >
          <div className="font-semibold">{copy.retreat}</div>
          <div className="text-ink-secondary mt-1 text-sm leading-6">
            {copy.retreatNote}
          </div>
        </button>
      </div>
    </div>
  );
}
