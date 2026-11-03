import { cn } from '@app/lib/cn';
import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './mystery-scenes.css';
import { MysterySeal } from './MysteryCaseBoard';

type Guard = NonNullable<MysteryPlayerView['exits'][number]['guard']>;

function Choice({
  title,
  note,
  primary,
  disabled,
  onClick,
}: {
  title: string;
  note: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'w-full border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        primary
          ? 'border-crimson/60 hover:bg-crimson/5'
          : 'border-ink/20 hover:bg-ink/5',
      )}
      onClick={onClick}
    >
      <div className={cn('font-semibold', primary && 'text-crimson')}>
        {title}
      </div>
      <div className="text-ink-secondary mt-0.5 text-sm">{note}</div>
    </button>
  );
}

/**
 * 守卫对峙卡：去路被拦住时整屏压暗，正中写明谁拦住了去哪儿，
 * 给出应战、化解、先退开三个选择。
 */
export function MysteryGuardCard({
  guard,
  roomName,
  processing,
  exhausted,
  onFight,
  onBypass,
  onClose,
}: {
  guard: Guard;
  roomName: string;
  processing: boolean;
  exhausted: boolean;
  onFight: () => void;
  onBypass: () => void;
  onClose: () => void;
}) {
  useBodyScrollLock(true);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${guard.name}拦住了去路`}
      className="mystery-scene bg-ink/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mystery-guard-card bg-paper border-crimson w-full max-w-md space-y-5 border-t-4 p-6 shadow-[0_20px_60px_rgba(44,24,16,0.35)]">
        <div className="flex items-center gap-4">
          <MysterySeal name={guard.name} />
          <div>
            <div className="text-ink-secondary text-sm">
              去往{roomName}的路被拦住了
            </div>
            <div className="text-xl font-semibold">{guard.name}</div>
          </div>
        </div>

        <p className="leading-8">{guard.description}</p>

        <div className="space-y-2">
          <Choice
            primary
            title="应战"
            note="进入一场战斗，胜了就能过去。耗 1 点行动力。"
            disabled={processing || exhausted}
            onClick={onFight}
          />
          <Choice
            title="化解"
            note={
              guard.canBypass
                ? '你已经有化解的办法，可以不战而过。耗 1 点行动力。'
                : '你还没有化解的办法，线索可能在别处。'
            }
            disabled={processing || exhausted || !guard.canBypass}
            onClick={onBypass}
          />
          <Choice
            title="先退开"
            note="回到调查，不耗行动力。"
            onClick={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
