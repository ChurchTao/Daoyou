import { cn } from '@shared/lib/cn';
import { useEffect, useRef, type ReactNode } from 'react';
import type { RoomActorAppearance } from './RoomView';

export interface NpcConversationActor {
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  appearance?: RoomActorAppearance;
}

export interface NpcConversationMessage {
  id: string;
  speaker?: string;
  body: ReactNode;
  tone?: 'normal' | 'muted' | 'attention';
  gesture?: ReactNode;
  after?: ReactNode;
  align?: 'start' | 'end';
}

export interface NpcConversationOption {
  id: string;
  label: string;
  tone?: 'normal' | 'primary' | 'muted';
  disabled?: boolean;
}

export interface NpcConversationProps {
  actor: NpcConversationActor;
  messages: readonly NpcConversationMessage[];
  options?: readonly NpcConversationOption[];
  selectedOptionId?: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  context?: ReactNode;
  transcriptIntro?: ReactNode;
  containedTranscript?: boolean;
  density?: 'default' | 'compact';
  composer?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  onSelectOption?(optionId: string): void;
}

const messageToneClass = {
  normal: 'text-ink',
  muted: 'text-ink-secondary',
  attention: 'text-crimson',
} as const;

export function NpcConversation({
  actor,
  messages,
  options = [],
  selectedOptionId,
  busy = false,
  error,
  children,
  context,
  transcriptIntro,
  containedTranscript = false,
  density = 'default',
  composer,
  actions,
  footer,
  onSelectOption,
}: NpcConversationProps) {
  const appearance = actor.appearance ?? 'person';
  const compact = density === 'compact';
  const transcriptRef = useRef<HTMLDivElement>(null);
  const latestMessageId = messages[messages.length - 1]?.id;
  const latestMessageBody = messages[messages.length - 1]?.body;
  const previousLatestMessageIdRef = useRef<typeof latestMessageId>(undefined);
  const previousLatestMessageBodyRef =
    useRef<typeof latestMessageBody>(undefined);
  useEffect(() => {
    if (!containedTranscript) return;
    if (
      previousLatestMessageIdRef.current === latestMessageId &&
      previousLatestMessageBodyRef.current === latestMessageBody
    )
      return;
    previousLatestMessageIdRef.current = latestMessageId;
    previousLatestMessageBodyRef.current = latestMessageBody;
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [containedTranscript, latestMessageBody, latestMessageId]);
  return (
    <div
      className={cn(
        'grid md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]',
        !containedTranscript && 'min-h-[34rem]',
      )}
    >
      <aside className="border-ink/10 bg-ink/[0.025] flex items-center gap-4 border-b px-5 py-4 md:flex-col md:justify-start md:border-r md:border-b-0 md:px-6 md:pt-14 md:text-center">
        <span
          aria-hidden="true"
          className={cn(
            'text-ink w-16 shrink-0 text-center leading-none md:w-auto',
            appearance === 'facility'
              ? 'text-[3rem] md:text-[4.5rem]'
              : 'font-heading text-[3.75rem] md:text-[5.75rem]',
          )}
        >
          {actor.sigil}
        </span>
        <div>
          <h2 className="text-ink text-lg font-normal md:mt-4 md:text-xl">
            {actor.name}
          </h2>
          <p className="text-ink-secondary mt-1 text-sm">{actor.identity}</p>
          <p className="text-ink-secondary mt-2 max-w-36 text-xs leading-5">
            {actor.responsibility}
          </p>
        </div>
      </aside>

      <div
        className={cn(
          'min-w-0 px-5 sm:px-8 md:px-10',
          containedTranscript ? 'py-5 md:py-6' : 'py-7 md:py-10',
        )}
      >
        {context ? <div className="mb-5">{context}</div> : null}
        <div
          ref={transcriptRef}
          aria-live="polite"
          aria-busy={busy}
          className={cn(
            compact ? 'space-y-3' : 'space-y-4 sm:space-y-5',
            containedTranscript && [
              'overflow-y-auto overscroll-contain pr-2',
              compact
                ? 'h-[clamp(14rem,32dvh,20rem)] md:h-[clamp(16rem,35dvh,22rem)]'
                : 'h-[clamp(11rem,24dvh,15rem)] md:h-[clamp(11rem,22dvh,16rem)]',
            ],
          )}
        >
          {transcriptIntro ? <div>{transcriptIntro}</div> : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                message.align === 'end'
                  ? 'ml-auto max-w-[88%] text-right'
                  : 'max-w-[94%]',
              )}
            >
              {message.gesture ? (
                <p
                  className={cn(
                    'text-ink-secondary italic',
                    compact
                      ? 'mb-0.5 text-xs leading-5'
                      : 'mb-1 text-sm leading-7',
                  )}
                >
                  {message.gesture}
                </p>
              ) : null}
              <p
                className={cn(
                  compact
                    ? 'text-sm leading-6 sm:text-base sm:leading-7'
                    : 'text-base leading-8 sm:text-lg sm:leading-9',
                  messageToneClass[message.tone ?? 'normal'],
                )}
              >
                {message.speaker && appearance === 'person' ? (
                  <>
                    {typeof message.body === 'string' && message.body === '' ? (
                      <span className="text-ink-secondary">正在斟酌措辞……</span>
                    ) : null}
                    <span className="sr-only">{message.speaker}：</span>
                    <span aria-hidden="true">“</span>
                    {message.body}
                    <span aria-hidden="true">”</span>
                  </>
                ) : (
                  message.body
                )}
              </p>
              {message.after ? (
                <div className={cn('text-left', compact ? 'mt-2' : 'mt-3')}>
                  {message.after}
                </div>
              ) : null}
            </div>
          ))}
          {error ? (
            <p className="text-crimson text-sm leading-7">{error}</p>
          ) : null}
        </div>

        {composer ? <div className="mt-4">{composer}</div> : null}

        {children ? <div className="mt-5">{children}</div> : null}

        {actions ? (
          <div className="[&>button]:border-crimson/45 [&>button]:bg-crimson/6 [&>button]:hover:bg-crimson/10 [&>button]:focus-visible:outline-crimson mt-5 space-y-2 [&>button]:w-full [&>button]:justify-start [&>button]:border-l-2 [&>button]:px-5 [&>button]:py-3 [&>button]:text-left [&>button]:text-base [&>button]:focus-visible:outline-2 [&>button]:focus-visible:outline-offset-[-2px]">
            {actions}
          </div>
        ) : null}

        {options.length > 0 ? (
          <div className={cn('mt-3', compact ? 'space-y-1.5' : 'space-y-2')}>
            {options.map((option) => {
              const selected = option.id === selectedOptionId;
              const tone = option.tone ?? 'normal';
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy || option.disabled}
                  aria-pressed={
                    selectedOptionId === undefined ? undefined : selected
                  }
                  onClick={() => onSelectOption?.(option.id)}
                  className={cn(
                    'border-ink/15 bg-ink/[0.025] focus-visible:outline-crimson enabled:hover:border-crimson/45 enabled:hover:bg-crimson/6 enabled:hover:text-crimson flex w-full cursor-pointer items-start border-l-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                    compact ? 'px-4 py-2.5' : 'px-5 py-3',
                    tone === 'primary'
                      ? 'text-crimson'
                      : tone === 'muted'
                        ? 'text-ink-secondary'
                        : 'text-ink',
                    selected && 'border-crimson/45 bg-crimson/6 text-crimson',
                    (busy || option.disabled) &&
                      'cursor-not-allowed opacity-50',
                  )}
                >
                  <span
                    className={cn('block', compact ? 'text-sm' : 'text-base')}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {footer ? (
          <div className={cn(compact ? 'mt-4' : 'mt-5')}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
