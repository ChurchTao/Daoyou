import Link from '@app/components/router/AppLink';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

const shell =
  'group text-ink focus-visible:outline-crimson relative block min-h-11 w-full cursor-pointer bg-transparent py-1.5 pl-7 text-left text-lg leading-8 outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * 纸页上一句可以点的话，和演出里的选项是同一种写法：
 * 红点起头，动作那几个字带下划线，后面跟一句小字交代。
 */
export function HomeAct({
  lead,
  children,
  note,
  href,
  onClick,
  busy = false,
  guide,
}: {
  /** 动作本身，带下划线的那几个字。 */
  lead: ReactNode;
  /** 接在动作后面的半句话。 */
  children?: ReactNode;
  /** 小字交代：还差什么、有多少。 */
  note?: ReactNode;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  guide?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="bg-crimson absolute top-[1.1rem] left-1.5 size-1.5 rounded-full"
      />
      <span className="decoration-ink/35 group-hover:text-crimson group-hover:decoration-crimson group-focus-visible:text-crimson underline decoration-1 underline-offset-[6px] transition-colors">
        {lead}
      </span>
      {children}
      {note ? (
        <span className="text-ink-secondary ml-3 text-sm">{note}</span>
      ) : null}
    </>
  );

  return href ? (
    <Link href={href} className={shell} data-guide={guide}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(shell, busy && 'cursor-wait')}
      data-guide={guide}
    >
      {body}
    </button>
  );
}

/** 纸页上的小标签：眼前、来人、手边…… */
export function HomeLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ink-secondary mb-2 text-xs font-normal tracking-[0.28em]">
      {children}
    </h2>
  );
}
