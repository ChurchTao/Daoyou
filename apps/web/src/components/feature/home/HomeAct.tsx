import Link from '@app/components/router/AppLink';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

const shell =
  'text-ink relative block min-h-11 w-full py-1.5 pl-7 text-left text-lg leading-8';
const interactive =
  'group focus-visible:outline-crimson cursor-pointer bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/** 洞府条目统一用红点和下划线。仅提供链接或操作时才可交互。 */
export function HomeAct({
  lead,
  note,
  href,
  onClick,
  busy = false,
  disabled = false,
  guide,
}: {
  /** 带下划线的正文。 */
  lead: ReactNode;
  /** 小字交代：还差什么、有多少。 */
  note?: ReactNode;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  guide?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute top-[1.1rem] left-1.5 size-1.5 rounded-full',
          disabled ? 'bg-ink/30' : 'bg-crimson',
        )}
      />
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span
          className={
            disabled
              ? 'text-ink-secondary'
              : 'decoration-ink/35 group-hover:text-crimson group-hover:decoration-crimson group-focus-visible:text-crimson underline decoration-1 underline-offset-[6px] transition-colors'
          }
        >
          {lead}
        </span>
        {note ? (
          <span className="text-ink-secondary text-sm leading-6">{note}</span>
        ) : null}
      </span>
    </>
  );

  if (!href && !onClick) return <p className={shell}>{body}</p>;

  return href ? (
    <Link href={href} className={cn(shell, interactive)} data-guide={guide}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={cn(
        shell,
        interactive,
        disabled && 'cursor-default',
        busy && 'cursor-wait',
      )}
      data-guide={guide}
    >
      {body}
    </button>
  );
}

export function HomeLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ink-secondary mb-2 text-xs font-normal tracking-[0.28em]">
      {children}
    </h2>
  );
}
