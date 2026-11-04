import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import type {
  MysteryLogEntry,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './mystery-scenes.css';
import { MysteryLogLine } from './MysteryLogLine';

type Mechanism = NonNullable<MysteryPlayerView['objects'][number]['mechanism']>;

/** 四个部件按上、右、下、左排在盘上（百分比坐标）。 */
const SLOTS = [
  { x: 50, y: 13 },
  { x: 87, y: 50 },
  { x: 50, y: 87 },
  { x: 13, y: 50 },
];

/** 每按错一次多一道裂纹。 */
const CRACKS = [
  'M50 38 L44 30 L46 22 L40 14',
  'M61 52 L70 56 L76 52 L86 60',
  'M45 60 L40 70 L44 76 L38 86',
];

/**
 * 机关场景：整屏切到机关盘。部件环形排开，依次点选连成墨线，
 * 已找到的提示贴在一旁；按错盘面一震、多一道裂纹，解开时封印晕开。
 */
export function MysteryMechanismScene({
  mechanism,
  lines,
  processing,
  actionsLeft,
  onClose,
  onSubmit,
}: {
  mechanism: Mechanism;
  /** 本回合的叙事，提交后显示反噬或开启的描写。 */
  lines: MysteryLogEntry[];
  processing: boolean;
  actionsLeft: number;
  onClose: () => void;
  onSubmit: (mechanismId: string, sequence: string[]) => Promise<void>;
}) {
  useBodyScrollLock(true);
  const [picked, setPicked] = useState<string[]>([]);
  // 提交时的失败次数，用来判断这一次是否按错。
  const [submitted, setSubmitted] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = mechanism.solved || mechanism.locked;
  const backlash =
    submitted !== null && !processing && mechanism.failures > submitted;
  const remaining = mechanism.maxFailures - mechanism.failures;
  const pos = (id: string) =>
    SLOTS[mechanism.parts.findIndex((p) => p.id === id)] ?? SLOTS[0]!;
  const labelOf = (id: string) =>
    mechanism.parts.find((p) => p.id === id)?.label ?? id;

  const toggle = (id: string) => {
    setSubmitted(null);
    setPicked((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  };

  const submit = () => {
    const sequence = picked;
    setSubmitted(mechanism.failures);
    setPicked([]);
    void onSubmit(mechanism.id, sequence);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mechanism.name}
      className="mystery-scene bg-paper fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-ink-secondary text-sm">机关</div>
            <h2 className="text-xl font-semibold">{mechanism.name}</h2>
          </div>
          <InkButton variant="ghost" onClick={onClose}>
            回到调查
          </InkButton>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div
            key={mechanism.failures}
            className={cn(
              'relative mx-auto aspect-square w-full max-w-[22rem]',
              backlash && 'mystery-disc-backlash',
              mechanism.locked && 'opacity-50 grayscale',
            )}
          >
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <circle
                cx="50"
                cy="50"
                r="37"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="0.6"
              />
              <circle
                cx="50"
                cy="50"
                r="12"
                fill="none"
                stroke="currentColor"
                strokeOpacity={mechanism.solved ? 0.8 : 0.35}
                strokeWidth={mechanism.solved ? 1.4 : 0.6}
                className={mechanism.solved ? 'text-crimson' : undefined}
              />
              {mechanism.solved ? (
                <circle
                  cx="50"
                  cy="50"
                  r="12"
                  className="mystery-seal-bloom text-crimson"
                  fill="currentColor"
                  fillOpacity="0.25"
                />
              ) : null}
              {picked.length > 1 ? (
                <polyline
                  points={picked
                    .map((id) => `${pos(id).x},${pos(id).y}`)
                    .join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {CRACKS.slice(0, mechanism.failures).map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  className={cn(
                    'text-crimson',
                    i === mechanism.failures - 1 && backlash && 'mystery-crack',
                  )}
                />
              ))}
            </svg>
            <div className="text-ink-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs">
              {mechanism.solved ? '已开启' : mechanism.locked ? '锁死' : '封印'}
            </div>
            {mechanism.parts.map((part, i) => {
              const order = picked.indexOf(part.id);
              const slot = SLOTS[i]!;
              return (
                <button
                  key={part.id}
                  type="button"
                  disabled={
                    done || processing || (order < 0 && picked.length >= 3)
                  }
                  aria-pressed={order >= 0}
                  className={cn(
                    'absolute flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm transition-colors md:size-20 md:text-base',
                    order >= 0
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper border-ink/30 hover:border-ink disabled:hover:border-ink/30',
                  )}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => toggle(part.id)}
                >
                  {part.label}
                  {order >= 0 ? (
                    <span className="bg-crimson text-paper absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full font-mono text-xs">
                      {order + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-ink-secondary mb-2 text-sm">
                你找到的提示
              </div>
              <ul className="space-y-2">
                {mechanism.hints.map((hint, i) => (
                  <li
                    key={i}
                    className={cn(
                      'border-l-2 py-1 pl-3',
                      hint
                        ? 'border-ink/40'
                        : 'border-ink/15 text-ink-secondary text-sm',
                    )}
                  >
                    {hint ?? '尚未找到，线索可能在别处'}
                  </li>
                ))}
              </ul>
            </div>

            {done ? null : (
              <>
                <p className="text-sm">
                  <span className="text-ink-secondary">次序：</span>
                  {picked.length > 0
                    ? picked.map(labelOf).join(' → ')
                    : '依次点选三个部件'}
                </p>
                <p
                  className={cn(
                    'text-sm',
                    remaining <= 1 ? 'text-crimson' : 'text-ink-secondary',
                  )}
                >
                  按错多耗 1 点行动力。
                  {remaining <= 1
                    ? '再错一次就会锁死。'
                    : `还能错 ${remaining - 1} 次，错满 ${mechanism.maxFailures} 次就锁死。`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <InkButton
                    variant="primary"
                    disabled={
                      processing || picked.length !== 3 || actionsLeft <= 0
                    }
                    pending={processing}
                    pendingLabel="机关转动中……"
                    onClick={submit}
                  >
                    确认这个次序
                  </InkButton>
                  <InkButton
                    variant="ghost"
                    disabled={processing || picked.length === 0}
                    onClick={() => setPicked((prev) => prev.slice(0, -1))}
                  >
                    撤回一步
                  </InkButton>
                </div>
              </>
            )}
          </div>
        </div>

        {submitted !== null && !processing ? (
          <div className="mx-auto w-full max-w-2xl space-y-3">
            {lines.map((entry, i) => (
              <MysteryLogLine key={i} entry={entry} />
            ))}
            {done ? (
              <div className="pt-2 text-center">
                <InkButton variant="primary" onClick={onClose}>
                  回到调查
                </InkButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
