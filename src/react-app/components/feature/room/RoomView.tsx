import { cn } from '@shared/lib/cn';
import { useEffect, useRef, type ReactNode } from 'react';

export type RoomActorStatusTone = 'neutral' | 'active' | 'attention' | 'muted';
export type RoomActorAppearance = 'person' | 'facility';

export interface RoomActorView {
  id: string;
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  appearance?: RoomActorAppearance;
  status?: {
    label: string;
    tone?: RoomActorStatusTone;
  };
  guideAnchor?: string;
  disabled?: boolean;
}

export interface RoomViewProps {
  eyebrow?: string;
  description: string;
  actors: readonly RoomActorView[];
  selectedId?: string;
  onSelect(actorId: string): void;
  detail?: ReactNode;
  prompt?: string;
  promptDetail?: string;
}

const statusToneClass: Record<RoomActorStatusTone, string> = {
  neutral: 'text-ink-secondary',
  active: 'text-ink',
  attention: 'text-crimson',
  muted: 'text-ink-secondary/60',
};

export function RoomView({
  eyebrow,
  description,
  actors,
  selectedId,
  onSelect,
  detail,
  prompt = '选择一位人物，与其交谈',
  promptDetail,
}: RoomViewProps) {
  const detailRef = useRef<HTMLDivElement>(null);
  const conversationOpen = Boolean(selectedId && detail);

  useEffect(() => {
    if (!conversationOpen) return;
    const frame = window.requestAnimationFrame(() =>
      detailRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [conversationOpen, selectedId]);

  return (
    <section className="border-ink/20 min-h-[34rem] border bg-[rgba(248,243,230,0.42)]">
      {conversationOpen ? (
        <div
          id="room-conversation"
          ref={detailRef}
          tabIndex={-1}
          className="focus-visible:outline-crimson min-h-[34rem] focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          {detail}
        </div>
      ) : (
        <div className="flex min-h-[34rem] flex-col px-4 py-7 sm:px-7 sm:py-8">
          <header className="mx-auto max-w-3xl text-center">
            {eyebrow ? (
              <p className="text-ink-secondary text-xs tracking-[0.3em] sm:text-sm">
                {eyebrow}
              </p>
            ) : null}
            <p className="text-ink-secondary mt-4 text-sm leading-7 sm:text-base sm:leading-8">
              {description}
            </p>
          </header>

          <div
            aria-label={
              actors.some((actor) => actor.appearance === 'facility')
                ? '房间中的人物与设施'
                : '房间中的人物'
            }
            className="mx-auto my-8 grid w-full max-w-3xl flex-1 grid-cols-2 content-center gap-3 sm:my-9 md:grid-cols-3 md:gap-4"
          >
            {actors.map((actor) => {
              const tone = actor.status?.tone ?? 'neutral';
              const appearance = actor.appearance ?? 'person';
              return (
                <button
                  key={actor.id}
                  type="button"
                  disabled={actor.disabled}
                  data-guide={actor.guideAnchor}
                  onClick={() => onSelect(actor.id)}
                  className={cn(
                    'border-ink/20 hover:border-crimson/35 focus-visible:outline-crimson group flex min-h-40 w-full min-w-0 flex-col items-center justify-center border border-dashed px-3 py-4 text-center transition-[color,border-color,background-color,transform] focus-visible:outline-2 focus-visible:outline-offset-4 md:min-h-48 md:px-4 md:py-5',
                    'cursor-pointer hover:bg-[rgba(248,243,230,0.6)] md:hover:-translate-y-0.5',
                    actor.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'text-ink group-hover:text-crimson leading-none transition-colors',
                      appearance === 'facility'
                        ? 'text-[2.75rem] md:text-[3.25rem]'
                        : 'font-heading text-[3.25rem] md:text-[3.75rem]',
                    )}
                  >
                    {actor.sigil}
                  </span>
                  <strong className="text-ink mt-3 min-w-0 max-w-full text-base font-normal break-words md:text-lg">
                    {actor.name}
                  </strong>
                  <span className="text-ink-secondary mt-1 text-xs md:text-sm">
                    {actor.identity}
                  </span>
                  <span className="text-ink-secondary mt-2 text-xs leading-5">
                    {actor.responsibility}
                  </span>
                  {actor.status ? (
                    <span
                      className={cn(
                        'mt-3 flex items-center gap-2 text-xs md:text-sm',
                        statusToneClass[tone],
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                      />
                      {actor.status.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <footer className="text-center">
            <p className="text-ink text-sm sm:text-base">{prompt}</p>
            {promptDetail ? (
              <p className="text-ink-secondary mt-1 text-sm">{promptDetail}</p>
            ) : null}
          </footer>
        </div>
      )}
    </section>
  );
}
