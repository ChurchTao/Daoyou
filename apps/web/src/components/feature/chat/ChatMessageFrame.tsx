import { cn } from '@app/lib/cn';
import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

export interface ChatMessageFrameProps {
  messageId?: string;
  sequence?: number;
  mine?: boolean;
  senderName: string;
  sender?: ReactNode;
  createdAt: string;
  own?: boolean;
  grouped?: boolean;
  highlighted?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
  articleAttributes?: Omit<HTMLAttributes<HTMLElement>, 'children'>;
  system?: boolean;
  beforeBody?: ReactNode;
  ownBackground?: boolean;
  bodyClassName?: string;
  onBodyClick?: MouseEventHandler<HTMLDivElement>;
}

export function ChatMessageFrame({
  messageId,
  sequence,
  senderName,
  sender,
  createdAt,
  own = false,
  mine = own,
  grouped = false,
  highlighted = false,
  trailing,
  children,
  articleAttributes = {},
  system = false,
  beforeBody,
  ownBackground = true,
  bodyClassName,
  onBodyClick,
}: ChatMessageFrameProps) {
  const { className, ...attributes } = articleAttributes;
  return (
    <article
      {...attributes}
      data-message-id={messageId}
      data-sequence={sequence}
      data-mine={mine ? 'true' : undefined}
      aria-label={
        attributes['aria-label'] ??
        (grouped ? `${senderName} 连续发言` : undefined)
      }
      className={cn(
        'group min-w-0',
        grouped ? 'py-1' : 'py-1.5',
        highlighted && 'bg-teal/8',
        className,
      )}
    >
      <div className={cn('flex min-w-0 gap-2', system && 'pl-1')}>
        {grouped ? (
          <div className="relative w-7 shrink-0" aria-hidden="true">
            <span className="border-ink/20 absolute -top-2 left-3.5 h-5 w-2 border-b border-l" />
          </div>
        ) : !system ? (
          <div
            className="bg-ink/5 text-ink-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
            aria-hidden="true"
          >
            {Array.from(senderName)[0]}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {!grouped ? (
            <div className="mb-0.5 flex h-7 items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-1.5">
                {sender ?? (
                  <span
                    className="min-w-0 truncate font-semibold"
                    title={senderName}
                  >
                    {senderName}
                  </span>
                )}
                {own && !system ? (
                  <span className="text-teal text-xs">你</span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {trailing}
                <time
                  className="text-ink-secondary shrink-0 font-mono text-xs"
                  dateTime={createdAt}
                  title={new Date(createdAt).toLocaleString('zh-CN')}
                >
                  {timeFormatter.format(new Date(createdAt))}
                </time>
              </div>
            </div>
          ) : null}
          {beforeBody}
          <div
            className={cn(
              'text-sm leading-6 break-words whitespace-pre-wrap',
              own && ownBackground && 'bg-teal/5 px-2.5',
              own && ownBackground && (grouped ? 'py-1' : 'py-1.5'),
              bodyClassName,
            )}
            onClick={onBodyClick}
          >
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}
