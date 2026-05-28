import Link from '@app/components/router/AppLink';
import {
  AUTH_LAYOUT_ROUTE_ID,
  type AuthLoaderData,
} from '@app/lib/router/routeData';
import type { ReactNode } from 'react';
import { useRouteLoaderData } from 'react-router';

interface AuthPageShellProps {
  title: string;
  lead: string;
  subtitle?: string;
  backHref?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthPageShell({
  title,
  lead,
  subtitle,
  backHref,
  footer,
  children,
}: AuthPageShellProps) {
  const authLoaderData = useRouteLoaderData(AUTH_LAYOUT_ROUTE_ID) as
    | AuthLoaderData
    | undefined;
  const announcement = authLoaderData?.announcement?.trim() || null;

  return (
    <div className="bg-paper relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url('/assets/light-grey-floral-motif.png')",
          backgroundPosition: 'center top',
          backgroundRepeat: 'repeat',
          backgroundSize: '420px',
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          {announcement ? (
            <div className="border-ink/15 bg-bgpaper/88 mb-4 flex items-center gap-3 overflow-hidden border border-dashed px-3 py-2 shadow-[0_8px_20px_rgba(44,24,16,0.05)]">
              <span className="text-ink-secondary shrink-0 tracking-[0.22em]">
                公告
              </span>
              <div className="auth-announcement-marquee min-w-0 flex-1">
                <div className="auth-announcement-track">
                  <span className="auth-announcement-segment">
                    <span className="auth-announcement-copy">
                      {announcement}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-ink-secondary/70 px-4"
                    >
                      ·
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="auth-announcement-segment"
                  >
                    <span className="auth-announcement-copy">
                      {announcement}
                    </span>
                    <span className="text-ink-secondary/70 px-4">·</span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <header className="mb-4 text-center">
            <p className="text-ink-secondary/80 mb-3 text-[0.72rem] tracking-[0.38em] sm:mb-4">
              WANJIE DAOYOU
            </p>
            <div className="border-ink/12 bg-paper/90 mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border border-dashed shadow-[0_12px_36px_rgba(44,24,16,0.08)] sm:mb-5 sm:h-32 sm:w-32">
              <img
                src="/assets/daoyou_logo.png"
                alt="万界道友 Logo"
                className="h-20 w-20 object-contain opacity-95 sm:h-24 sm:w-24"
              />
            </div>
            <h1 className="font-heading text-ink text-[3.15rem] leading-none sm:text-[4.4rem]">
              万界道友
            </h1>
            <p className="text-crimson mt-3 text-sm tracking-[0.28em] sm:mt-4 sm:text-[0.95rem]">
              一入万界，修行不止。
            </p>
            <p className="text-ink-secondary mx-auto mt-4 max-w-md text-sm leading-7 sm:text-base">
              在纸墨之间落下道号，自此入界修行、历练、炼造与论道。
            </p>
          </header>

          <section className="border-ink/18 bg-bgpaper/92 relative overflow-hidden border border-dashed px-5 py-5 shadow-lg sm:px-7 sm:py-6">
            <div className="relative">
              {backHref ? (
                <Link
                  href={backHref}
                  className="text-ink-secondary hover:text-crimson mb-4 inline-flex items-center text-sm no-underline transition-colors"
                >
                  [← 返回]
                </Link>
              ) : null}

              <div className="text-center sm:text-left">
                <h2 className="text-ink text-[1.7rem] leading-tight font-semibold sm:text-[1.9rem]">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-ink-secondary mt-2 text-sm leading-6">
                    {subtitle}
                  </p>
                ) : null}
                <p className="text-ink mt-3 text-base leading-7">{lead}</p>
              </div>

              <div className="mt-5 space-y-4">{children}</div>
            </div>
          </section>

          {footer ? (
            <div className="mt-5 text-center text-sm leading-7">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
