import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import type { RoomActorView } from './RoomView';
import {
  RoomPresentation,
  type NpcConversationPresentation,
} from './roomPresentation';

export type { NpcConversationPresentation } from './roomPresentation';

export type NpcConversationActor = Pick<
  RoomActorView,
  'sigil' | 'name' | 'identity' | 'responsibility' | 'appearance' | 'portrait'
>;

export interface NpcConversationMessage {
  id: string;
  speaker?: string;
  body: ReactNode;
  tone?: 'normal' | 'muted' | 'attention';
  gesture?: ReactNode;
  after?: ReactNode;
  align?: 'start' | 'end';
  verbatim?: boolean;
}

export interface NpcConversationOption {
  id: string;
  label: ReactNode;
  tone?: 'normal' | 'primary' | 'muted';
  disabled?: boolean;
  guideAnchor?: string;
}

export function NpcConversationPresentationProvider({
  presentation,
  children,
}: {
  presentation: NpcConversationPresentation;
  children: ReactNode;
}) {
  return <RoomPresentation value={presentation}>{children}</RoomPresentation>;
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
  collapseHistory?: boolean;
  density?: 'default' | 'compact';
  presentation?: NpcConversationPresentation;
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
  collapseHistory = false,
  density = 'default',
  presentation,
  composer,
  actions,
  footer,
  onSelectOption,
}: NpcConversationProps) {
  const inheritedPresentation = useContext(RoomPresentation);
  const layout = presentation ?? inheritedPresentation;
  const immersive = layout === 'immersive';
  const sceneLayout = layout !== 'room';
  const scrollableSceneTranscript = sceneLayout && containedTranscript;
  const appearance = actor.appearance ?? 'person';
  const compact = density === 'compact';
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followsLatestRef = useRef(true);
  const latestMessageId = messages[messages.length - 1]?.id;
  const latestMessageBody = messages[messages.length - 1]?.body;
  const previousLatestMessageIdRef = useRef<typeof latestMessageId>(undefined);
  const previousLatestMessageBodyRef =
    useRef<typeof latestMessageBody>(undefined);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!containedTranscript || !transcript) return;
    if (
      previousLatestMessageIdRef.current === latestMessageId &&
      previousLatestMessageBodyRef.current === latestMessageBody
    )
      return;
    previousLatestMessageIdRef.current = latestMessageId;
    previousLatestMessageBodyRef.current = latestMessageBody;
    if (sceneLayout && !followsLatestRef.current) return;
    transcript.scrollTo({
      top: transcript.scrollHeight,
      behavior: sceneLayout ? 'instant' : 'smooth',
    });
  }, [containedTranscript, latestMessageBody, latestMessageId, sceneLayout]);
  const historyLimit =
    sceneLayout && collapseHistory ? Math.max(0, messages.length - 2) : 0;
  const firstRichMessage =
    historyLimit > 0
      ? messages.findIndex(
          (message) =>
            typeof message.body !== 'string' ||
            message.gesture ||
            message.after,
        )
      : -1;
  const historyCount =
    firstRichMessage < 0
      ? historyLimit
      : Math.min(historyLimit, firstRichMessage);
  const transcriptMessages = messages.map((message, index) => (
    <div
      key={message.id}
      className={cn(
        message.align === 'end'
          ? 'ml-auto max-w-[88%] text-right'
          : 'max-w-[94%]',
        sceneLayout && 'wrap-anywhere',
        sceneLayout &&
          index === messages.length - 1 && [
            'border-crimson/35',
            message.align === 'end' ? 'border-r-2 pr-3' : 'border-l-2 pl-3',
          ],
      )}
    >
      {message.gesture ? (
        <p
          className={cn(
            'text-ink-secondary italic',
            compact ? 'mb-0.5 text-xs leading-5' : 'mb-1 text-sm leading-7',
          )}
        >
          {message.gesture}
        </p>
      ) : null}
      <p
        className={cn(
          immersive
            ? 'text-base leading-7 sm:leading-8'
            : compact || sceneLayout
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
            {!message.verbatim ? <span aria-hidden="true">“</span> : null}
            {message.body}
            {!message.verbatim ? <span aria-hidden="true">”</span> : null}
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
  ));
  return (
    <div
      className={cn(
        'grid',
        sceneLayout
          ? 'gap-4 md:grid-cols-[minmax(7rem,25%)_minmax(0,1fr)] md:gap-6'
          : [
              'md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]',
              !containedTranscript && 'min-h-[34rem]',
            ],
        immersive && 'mx-auto max-w-4xl md:gap-8',
      )}
    >
      <aside
        className={cn(
          'border-ink/10 flex min-w-0 items-center border-b md:flex-col md:border-r md:border-b-0 md:text-center',
          sceneLayout
            ? 'gap-3 pb-3 md:self-start md:pr-4 md:pb-0'
            : 'bg-ink/[0.025] gap-4 px-5 py-4 md:justify-start md:px-6 md:pt-14',
          immersive && 'md:pr-5',
        )}
      >
        {appearance === 'person' && actor.portrait ? (
          <GameIcon
            value={actor.portrait}
            purpose="artwork"
            className={
              immersive
                ? 'size-20 md:h-36 md:w-full md:max-w-36'
                : sceneLayout
                  ? 'size-16 md:h-28 md:w-full md:max-w-28'
                  : 'size-16 md:size-36'
            }
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'text-ink w-16 shrink-0 text-center leading-none md:w-auto',
              appearance === 'person' && 'font-heading',
              sceneLayout
                ? 'text-4xl md:text-6xl'
                : appearance === 'facility'
                  ? 'text-[3rem] md:text-[4.5rem]'
                  : 'text-[3.75rem] md:text-[5.75rem]',
            )}
          >
            {actor.sigil}
          </span>
        )}
        <div className={immersive ? 'min-w-0 wrap-anywhere' : undefined}>
          <h2
            className={cn(
              'text-ink text-lg font-normal',
              !sceneLayout && 'md:mt-4 md:text-xl',
              immersive && 'text-xl font-semibold',
            )}
          >
            {actor.name}
          </h2>
          {!sceneLayout || (actor.identity && actor.identity !== actor.name) ? (
            <p className="text-ink-secondary mt-1 text-sm">{actor.identity}</p>
          ) : null}
          {!sceneLayout || actor.responsibility ? (
            <p
              className={cn(
                'text-ink-secondary text-xs leading-5',
                sceneLayout ? 'mt-1' : 'mt-2 max-w-36',
              )}
            >
              {actor.responsibility}
            </p>
          ) : null}
        </div>
      </aside>

      <div
        className={cn(
          'min-w-0',
          !sceneLayout && [
            'px-5 sm:px-8 md:px-10',
            containedTranscript ? 'py-5 md:py-6' : 'py-7 md:py-10',
          ],
        )}
      >
        {context ? <div className="mb-5">{context}</div> : null}
        <div
          ref={transcriptRef}
          role={scrollableSceneTranscript ? 'region' : undefined}
          aria-label={scrollableSceneTranscript ? '交谈记录' : undefined}
          aria-live="polite"
          aria-busy={busy}
          tabIndex={scrollableSceneTranscript ? 0 : undefined}
          onScroll={
            scrollableSceneTranscript
              ? ({ currentTarget }) => {
                  const { scrollHeight, scrollTop, clientHeight } =
                    currentTarget;
                  followsLatestRef.current =
                    scrollHeight - scrollTop - clientHeight <= 32;
                }
              : undefined
          }
          className={cn(
            compact ? 'space-y-3' : 'space-y-4 sm:space-y-5',
            containedTranscript && [
              'overflow-y-auto overscroll-contain pr-2',
              sceneLayout
                ? 'focus-visible:outline-crimson max-h-[min(19rem,calc(var(--overlay-viewport-height,100dvh)*0.42))] focus-visible:outline-2 focus-visible:outline-offset-2'
                : compact
                  ? 'h-[clamp(14rem,32dvh,20rem)] md:h-[clamp(16rem,35dvh,22rem)]'
                  : 'h-[clamp(11rem,24dvh,15rem)] md:h-[clamp(11rem,22dvh,16rem)]',
            ],
          )}
        >
          {transcriptIntro ? <div>{transcriptIntro}</div> : null}
          {historyCount > 0 ? (
            <details className="text-ink-secondary text-sm" aria-live="off">
              <summary className="hover:text-ink focus-visible:outline-crimson w-fit cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-offset-2">
                先前对白 <span className="font-mono">{historyCount}</span> 条
              </summary>
              <div className="mt-3 space-y-3">
                {transcriptMessages.slice(0, historyCount)}
              </div>
            </details>
          ) : null}
          {transcriptMessages.slice(historyCount)}
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
                  data-guide={option.guideAnchor}
                  disabled={busy || option.disabled}
                  aria-pressed={
                    selectedOptionId === undefined ? undefined : selected
                  }
                  onClick={() => onSelectOption?.(option.id)}
                  className={cn(
                    'border-ink/15 focus-visible:outline-crimson enabled:hover:border-crimson/45 enabled:hover:bg-crimson/6 enabled:hover:text-crimson flex w-full cursor-pointer text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                    immersive
                      ? 'min-h-11 items-center border-b px-2.5 py-2 wrap-anywhere'
                      : 'bg-ink/[0.025] items-start border-l-2',
                    !immersive &&
                      (sceneLayout
                        ? 'min-h-11 px-3 py-2.5'
                        : compact
                          ? 'px-4 py-2.5'
                          : 'px-5 py-3'),
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
