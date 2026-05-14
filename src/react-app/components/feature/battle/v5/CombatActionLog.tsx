import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@shared/lib/cn';
import { LogPresenter } from '@shared/engine/battle-v5/systems/log/LogPresenter';
import type { LogSpan } from '@shared/engine/battle-v5/systems/log/types';

interface CombatActionLogProps {
  spans: LogSpan[];
  currentIndex: number;
}

export function CombatActionLog({
  spans,
  currentIndex,
}: CombatActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenter = useMemo(() => new LogPresenter(), []);

  const formattedLogs = useMemo(() => {
    return spans
      .map((span, originalIdx) => ({
        id: span.id,
        originalIdx,
        lines: presenter.formatSpan(span),
      }))
      .filter((item) => item.lines.length > 0);
  }, [spans, presenter]);

  const visibleLogs = useMemo(() => {
    return formattedLogs.filter((item) => item.originalIdx <= currentIndex);
  }, [formattedLogs, currentIndex]);

  useEffect(() => {
    if (visibleLogs.length === 0) return;

    const lastId = visibleLogs[visibleLogs.length - 1].id;
    const timer = setTimeout(() => {
      const activeElement = scrollRef.current?.querySelector(
        `[data-span-id="${lastId}"]`,
      );
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [visibleLogs]);

  return (
    <section className="battle-divider mt-1 pt-3">
      <p className="battle-caption mb-2 text-xs">战斗日志</p>

      <div
        ref={scrollRef}
        className="battle-report battle-scroll h-[36vh] min-h-[240px] overflow-y-auto pr-1 md:h-[42vh]"
      >
        <div className="space-y-2">
          {visibleLogs.map((item, idx) => {
            const isActive = idx === visibleLogs.length - 1;

            return (
              <div
                key={item.id}
                data-span-id={item.id}
                className={cn('px-1 py-1', isActive && 'bg-battle-crimson-soft')}
              >
                <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5">
                  <span
                    className={cn(
                      'flex h-7 items-center justify-center text-sm leading-none transition-colors md:h-8',
                      isActive ? 'text-crimson' : 'text-battle-muted',
                    )}
                  >
                    {isActive ? '▸' : '•'}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    {item.lines.map((line, lineIndex) => (
                      <p
                        key={lineIndex}
                        className={cn(
                          'text-sm leading-7 transition-colors md:text-base md:leading-8',
                          isActive ? 'text-ink' : 'text-battle-muted',
                        )}
                      >
                        <span dangerouslySetInnerHTML={{ __html: line }} />
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleLogs.length === 0 && (
            <div className="text-battle-muted flex h-full min-h-[220px] items-center justify-center text-sm italic">
              战斗即将开始...
            </div>
          )}

          <div className="h-12" />
        </div>
      </div>
    </section>
  );
}
