import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { RoomPresentation } from './roomPresentation';

export type RoomActorStatusTone = 'neutral' | 'active' | 'attention' | 'muted';
export type RoomActorAppearance = 'person' | 'facility';

export interface RoomActorView {
  id: string;
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  appearance?: RoomActorAppearance;
  portrait?: string;
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
  const immersive = useContext(RoomPresentation) === 'immersive';
  const detailRef = useRef<HTMLDivElement>(null);
  const rosterRef = useRef<HTMLDivElement>(null);
  const previousActor = useRef<string>(undefined);
  const conversationOpen = Boolean(selectedId && detail);

  useEffect(() => {
    if (conversationOpen) {
      previousActor.current = selectedId;
      const frame = window.requestAnimationFrame(() =>
        detailRef.current?.focus(),
      );
      return () => window.cancelAnimationFrame(frame);
    }
    if (immersive && previousActor.current) {
      const actor = `[data-room-actor="${CSS.escape(previousActor.current)}"]`;
      const frame = window.requestAnimationFrame(() => {
        previousActor.current = undefined;
        rosterRef.current?.querySelector<HTMLButtonElement>(actor)?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [conversationOpen, immersive, selectedId]);

  return (
    <section
      className={
        immersive ? 'min-w-0' : 'border-ink/20 bg-paper min-h-[34rem] border'
      }
    >
      {conversationOpen ? (
        <div
          id="room-conversation"
          ref={detailRef}
          role={immersive ? 'region' : undefined}
          aria-label={immersive ? '当前交谈' : undefined}
          tabIndex={-1}
          className={
            immersive
              ? 'outline-none'
              : 'focus-visible:outline-crimson min-h-[34rem] focus-visible:outline-2 focus-visible:outline-offset-[-2px]'
          }
        >
          {detail}
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col',
            immersive
              ? 'mx-auto max-w-4xl'
              : 'min-h-[34rem] px-4 py-7 sm:px-7 sm:py-8',
          )}
        >
          <header
            className={cn(
              'max-w-3xl',
              immersive ? 'mx-0' : 'mx-auto text-center',
            )}
          >
            {eyebrow ? (
              <p className="text-ink-secondary text-xs tracking-[0.3em] sm:text-sm">
                {eyebrow}
              </p>
            ) : null}
            <p
              className={cn(
                'text-ink-secondary text-sm leading-7 sm:text-base sm:leading-8',
                immersive ? 'mt-2' : 'mt-4',
              )}
            >
              {description}
            </p>
          </header>

          <div
            ref={rosterRef}
            role={immersive ? 'group' : undefined}
            aria-label={
              actors.some((actor) => actor.appearance === 'facility')
                ? '房间中的人物与设施'
                : '房间中的人物'
            }
            className={cn(
              'grid w-full gap-3 md:gap-4',
              immersive
                ? 'my-4 grid-cols-2 sm:my-6 md:grid-cols-3'
                : 'mx-auto my-8 max-w-3xl flex-1 grid-cols-2 content-center sm:my-9 md:grid-cols-3',
            )}
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
                  data-room-actor={actor.id}
                  onClick={() => onSelect(actor.id)}
                  className={cn(
                    'border-ink/20 focus-visible:outline-crimson group flex w-full min-w-0 cursor-pointer flex-col items-center border-dashed text-center transition-[color,border-color,background-color,transform] focus-visible:outline-2',
                    immersive
                      ? 'enabled:hover:border-crimson/35 enabled:hover:bg-paper/70 min-h-36 justify-start border-b px-2 py-2.5 focus-visible:outline-offset-[-2px] md:px-4 md:py-4'
                      : 'hover:border-crimson/35 hover:bg-paper-2 min-h-40 justify-center border px-3 py-4 focus-visible:outline-offset-4 md:min-h-48 md:px-4 md:py-5 md:hover:-translate-y-0.5',
                    actor.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {appearance === 'person' && actor.portrait ? (
                    <GameIcon
                      value={actor.portrait}
                      purpose="artwork"
                      className={
                        immersive ? 'size-20 md:size-28' : 'size-16 md:size-20'
                      }
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'text-ink group-hover:text-crimson leading-none transition-colors',
                        immersive &&
                          'flex size-20 shrink-0 items-center justify-center md:size-28',
                        appearance === 'facility'
                          ? 'text-[2.75rem] md:text-[3.25rem]'
                          : 'font-heading text-[3.25rem] md:text-[3.75rem]',
                      )}
                    >
                      {actor.sigil}
                    </span>
                  )}
                  <strong
                    className={cn(
                      'text-ink max-w-full min-w-0 text-base md:text-lg',
                      immersive
                        ? 'mt-1 font-semibold wrap-anywhere'
                        : 'mt-3 font-normal break-words',
                    )}
                  >
                    {actor.name}
                  </strong>
                  {!immersive || actor.identity !== actor.name ? (
                    <span className="text-ink-secondary mt-1 text-xs md:text-sm">
                      {actor.identity}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'text-ink-secondary text-xs leading-5',
                      immersive ? 'mt-1 wrap-anywhere' : 'mt-2',
                    )}
                  >
                    {actor.responsibility}
                  </span>
                  {actor.status ? (
                    <span
                      className={cn(
                        'flex items-center gap-2 text-xs md:text-sm',
                        immersive ? 'mt-1' : 'mt-3',
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

          <footer className={cn(!immersive && 'text-center')}>
            <p
              className={cn(
                'text-sm',
                immersive ? 'text-ink-secondary' : 'text-ink sm:text-base',
              )}
            >
              {prompt}
            </p>
            {promptDetail ? (
              <p className="text-ink-secondary mt-1 text-sm">{promptDetail}</p>
            ) : null}
          </footer>
        </div>
      )}
    </section>
  );
}
