import type { Mail } from '@app/components/mail/types';
import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});

export function SystemMailDirectory({
  mails,
  currentId,
  onSelect,
}: {
  mails: Mail[];
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul
      aria-label="系统传音信件"
      className="divide-ink/10 divide-y divide-dashed"
    >
      {mails.map((mail) => {
        const hasAttachments = Boolean(mail.attachments?.length);
        const waiting = hasAttachments && !mail.isClaimed;
        return (
          <li key={mail.id}>
            <button
              type="button"
              data-mail-row-id={mail.id}
              aria-label={`${mail.title}，${mail.isRead ? '已读' : '未读'}${waiting ? '，附件待领取' : hasAttachments && mail.isClaimed ? '，附件已领取' : ''}`}
              aria-current={currentId === mail.id ? 'true' : undefined}
              className={cn(
                'hover:bg-ink/4 focus-visible:outline-crimson flex w-full min-w-0 items-start gap-2.5 px-2 py-3 text-left',
                currentId === mail.id && 'bg-ink/5',
              )}
              onClick={() => onSelect(mail.id)}
            >
              <span
                className="bg-ink/5 text-ink-secondary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'inline-flex',
                    mail.isRead && !waiting && 'opacity-60 grayscale',
                  )}
                >
                  <GameIcon
                    value={waiting ? '🎁' : mail.isRead ? '📭' : '✉️'}
                  />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'min-w-0 truncate text-sm leading-6',
                      !mail.isRead
                        ? 'text-ink font-semibold'
                        : 'text-ink-secondary font-normal',
                    )}
                  >
                    {mail.title}
                  </span>
                  <time
                    dateTime={mail.createdAt}
                    title={new Date(mail.createdAt).toLocaleString('zh-CN')}
                    className={cn(
                      'shrink-0 font-mono text-xs',
                      mail.isRead
                        ? 'text-ink-secondary/75'
                        : 'text-ink-secondary',
                    )}
                  >
                    {dateFormatter.format(new Date(mail.createdAt))}
                  </time>
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'line-clamp-1 min-w-0 flex-1 text-sm leading-6',
                      mail.isRead
                        ? 'text-ink-secondary/75'
                        : 'text-ink-secondary',
                    )}
                  >
                    {mail.content}
                  </span>
                  {hasAttachments && mail.isClaimed ? (
                    <span
                      className="border-ink/15 text-ink-secondary inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs leading-4"
                      title="附件已领取"
                      aria-hidden="true"
                    >
                      <GameIcon value="✓" />
                      已领
                    </span>
                  ) : null}
                </span>
                {!mail.isRead || waiting ? (
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {!mail.isRead ? (
                      <span className="text-crimson">未读</span>
                    ) : null}
                    {waiting ? (
                      <span className="text-crimson">附件待领取</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
