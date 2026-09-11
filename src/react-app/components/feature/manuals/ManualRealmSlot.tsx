import { MAX_MANUALS_PER_SLOT } from '@shared/engine/combat-v6/manuals/compiler';
import { manualRule } from '@shared/engine/combat-v6/manuals/content';
import type {
  CharacterManualDefV1,
  CultivatorManualStateV1,
} from '@shared/engine/combat-v6/manuals/types';
import { useRef } from 'react';

const labels = {
  vitality: '体魄',
  strength: '力量',
  spirit: '精神',
  endurance: '耐力',
  speed: '速度',
  willpower: '意志',
};
export function ManualRealmSlot({
  realm,
  manuals,
  state,
  unlocked,
  disabled,
  onActivate,
  onStudy,
  onLearn,
}: {
  realm: CharacterManualDefV1['realm'];
  manuals: CharacterManualDefV1[];
  state: CultivatorManualStateV1 | null;
  unlocked: boolean;
  disabled: boolean;
  onActivate: (manual: CharacterManualDefV1) => void;
  onStudy: (manual: CharacterManualDefV1) => void;
  onLearn: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const activeIndex = manuals.findIndex((manual) =>
    state?.build.slots.some((slot) => slot.manualId === manual.id),
  );
  const current = manuals[activeIndex >= 0 ? activeIndex : 0];
  const progress = state?.learned.find(
    (entry) => entry.manualId === current?.id,
  );
  const maxLevel = current && manualRule(current).maxLevel;
  function switchBy(direction: number) {
    if (disabled || manuals.length < 2) return;
    onActivate(
      manuals[
        (Math.max(0, activeIndex) + direction + manuals.length) % manuals.length
      ],
    );
  }
  return (
    <section
      aria-label={`${realm}功法位`}
      className="relative min-w-0 pb-5 pl-4 last:pb-0 sm:pl-6"
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 -left-[4px] h-2 w-2 rotate-45 ${unlocked ? 'bg-ink/60' : 'border-ink/25 bg-bgpaper border'}`}
      />
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <h3 className={unlocked ? 'font-medium' : 'text-ink-secondary'}>
          {realm}
        </h3>
        {unlocked ? (
          <span className="text-ink-secondary">
            已学{' '}
            <span className="font-mono">
              {manuals.length}/{MAX_MANUALS_PER_SLOT}
            </span>
          </span>
        ) : null}
      </header>
      {!unlocked ? (
        <div className="border-ink/10 text-ink-secondary flex min-h-14 items-center justify-center gap-2 border text-xs">
          <span aria-hidden="true">◇</span>
          {realm}期开放
        </div>
      ) : !current ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onLearn}
          className="border-ink/20 hover:border-ink/40 text-ink-secondary flex min-h-18 w-full items-center justify-center gap-2 border border-dashed text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="text-lg">
            ＋
          </span>
          学习功法
        </button>
      ) : (
        <div
          className="border-ink/15 bg-paper/40 touch-pan-y border px-1 py-2 select-none sm:px-3"
          onPointerDown={(event) => {
            swiped.current = false;
            start.current =
              event.isPrimary && event.button === 0
                ? { x: event.clientX, y: event.clientY }
                : null;
          }}
          onPointerMove={(event) => {
            const origin = start.current;
            if (!origin || disabled || manuals.length < 2) return;
            const dx = event.clientX - origin.x;
            const dy = event.clientY - origin.y;
            if (Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              swiped.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
          onPointerUp={(event) => {
            const origin = start.current;
            start.current = null;
            if (!origin) return;
            const dx = event.clientX - origin.x;
            const dy = event.clientY - origin.y;
            if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              swiped.current = true;
              switchBy(dx < 0 ? 1 : -1);
            }
          }}
          onClickCapture={(event) => {
            if (swiped.current) {
              event.preventDefault();
              event.stopPropagation();
              swiped.current = false;
            }
          }}
        >
          <div className="flex min-w-0 items-center">
            {manuals.length > 1 ? (
              <button
                type="button"
                aria-label={`切换上一本${realm}功法`}
                disabled={disabled}
                onClick={() => switchBy(-1)}
                className="text-ink-secondary min-h-11 w-8 shrink-0 text-xl disabled:opacity-40"
              >
                ‹
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onStudy(current)}
              aria-label={`参悟${current.name}`}
              className="min-h-11 min-w-0 flex-1 px-1 text-center"
            >
              <span className="block text-sm font-medium">{current.name}</span>
              <span className="text-ink-secondary text-xs">
                <span className="font-mono">{progress?.level}</span> 层
                {current.rarity === 'rare' ? ' · 珍稀' : ''}
              </span>
            </button>
            {manuals.length > 1 ? (
              <button
                type="button"
                aria-label={`切换下一本${realm}功法`}
                disabled={disabled}
                onClick={() => switchBy(1)}
                className="text-ink-secondary min-h-11 w-8 shrink-0 text-xl disabled:opacity-40"
              >
                ›
              </button>
            ) : null}
          </div>
          <div className="my-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
            {current.effects.map((effect) => (
              <span key={effect.attribute}>
                {labels[effect.attribute]}{' '}
                <span className="font-mono">
                  +{effect.valuePerLevel * (progress?.level ?? 1)}
                </span>
              </span>
            ))}
          </div>
          <div className="flex min-h-10 items-center justify-between gap-1 px-1">
            <div
              className="flex items-center gap-1"
              aria-label={`已学${manuals.length}种，当前${current.name}生效`}
            >
              {manuals.map((manual) => (
                <span
                  key={manual.id}
                  aria-hidden="true"
                  className={`h-1 w-1 rounded-full ${manual.id === current.id ? 'bg-ink' : 'bg-ink/20'}`}
                />
              ))}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onStudy(current)}
                className="hover:text-crimson min-h-10 px-2 text-xs"
              >
                {progress?.level === maxLevel
                  ? '已圆满'
                  : progress?.level === progress?.unlockedLevel
                    ? '突破瓶颈'
                    : '参悟'}
              </button>
              {manuals.length < MAX_MANUALS_PER_SLOT ? (
                <button
                  type="button"
                  aria-label={`学习新的${realm}功法`}
                  disabled={disabled}
                  onClick={onLearn}
                  className="hover:text-crimson min-h-10 min-w-8 text-lg disabled:opacity-40"
                >
                  ＋
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
