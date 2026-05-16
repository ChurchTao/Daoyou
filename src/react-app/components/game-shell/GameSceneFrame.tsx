import { resolveGameScene } from '@app/lib/router/routeTitle';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import { useLocation, useMatches } from 'react-router';

const sceneGroupLabel: Record<string, string> = {
  cultivation: '【静修区域】',
  travel: '【行路区域】',
  craft: '【造化区域】',
  trade: '【交易区域】',
  service: '【见闻区域】',
};

export interface GameSceneFrameProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  headerMeta?: ReactNode;
  actionBar?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'lite' | 'workflow';
  contentClassName?: string;
}

export function GameSceneLoading({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <p className="loading-tip">{message}</p>
    </div>
  );
}

export function GameSceneAsideSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4',
        className,
      )}
    >
      <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
        {title}
      </div>
      {children}
    </section>
  );
}

export function GameSceneFrame({
  eyebrow,
  title,
  description,
  headerMeta,
  actionBar,
  aside,
  children,
  variant = 'default',
  contentClassName,
}: GameSceneFrameProps) {
  const location = useLocation();
  const matches = useMatches();
  const scene = resolveGameScene(matches);
  const sceneGroup = scene?.group ? sceneGroupLabel[scene.group] : null;
  const frameWidthClass = variant === 'lite' ? 'max-w-4xl' : 'max-w-5xl';
  const contentSpacingClass =
    variant === 'default' ? 'mt-4 space-y-5' : 'mt-4 space-y-4';
  const asideWidthClass =
    variant === 'workflow'
      ? 'lg:grid-cols-[minmax(0,1fr)_280px]'
      : 'lg:grid-cols-[minmax(0,1fr)_240px]';

  return (
    <div className="battle-scroll h-full overflow-y-auto">
      <div className={cn('mx-auto w-full px-3 py-3 md:px-6 md:py-4', frameWidthClass)}>
        <div
          className={cn(
            'grid gap-4',
            aside ? asideWidthClass : '',
          )}
        >
          <section className="border-battle-rule-strong animate-fade-in border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4 md:px-5 md:py-5">
            <div className="border-battle-rule-strong border-b border-dashed pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] tracking-[0.18em]">
                  <span className="text-battle-muted">场景</span>
                  <span className="text-ink tracking-[0.08em]">
                    {scene?.label ?? '道途'}
                  </span>
                  {sceneGroup ? (
                    <span className="text-teal tracking-[0.08em]">
                      {sceneGroup}
                    </span>
                  ) : null}
                  {eyebrow ? (
                    <span className="text-battle-muted tracking-[0.08em]">
                      {eyebrow}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <h1 className="text-3xl leading-none md:text-4xl">{title}</h1>
                  <span className="text-battle-muted hidden text-xs tracking-[0.12em] md:inline">
                    {location.pathname}
                  </span>
                </div>
                {description ? (
                  <div className="text-ink-secondary mt-3 max-w-3xl text-sm leading-7">
                    {description}
                  </div>
                ) : null}
              </div>
            </div>

            {headerMeta ? <div className="mt-4">{headerMeta}</div> : null}

            <div className={cn(contentSpacingClass, contentClassName)}>{children}</div>

            {actionBar ? (
              <div className="border-battle-rule-strong mt-5 border-t border-dashed pt-4">
                {actionBar}
              </div>
            ) : null}
          </section>

          {aside ? <aside className="space-y-4">{aside}</aside> : null}
        </div>
      </div>
    </div>
  );
}
