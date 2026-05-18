import { resolveGameScene } from '@app/lib/router/routeTitle';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import { useMatches } from 'react-router';
import { resolveGameSceneFrameHeader } from './gameSceneFrameHeader';

const sceneGroupLabel: Record<string, string> = {
  cultivation: '静修',
  travel: '行路',
  craft: '造化',
  trade: '交易',
  service: '见闻',
};

export interface GameSceneFrameProps {
  title?: ReactNode;
  description?: ReactNode;
  headerMeta?: ReactNode;
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

function SceneSurface({
  as = 'section',
  children,
  className,
}: {
  as?: 'section' | 'aside';
  children: ReactNode;
  className?: string;
}) {
  const Tag = as;

  return (
    <Tag
      className={cn(
        'animate-fade-in bg-[rgba(248,243,230,0.82)] bg-[linear-gradient(180deg,rgba(255,252,245,0.42),rgba(248,243,230,0))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_10px_30px_rgba(44,24,16,0.06)] backdrop-blur-[2px] md:px-5 md:py-5',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

function SceneBody({
  children,
  compact = false,
  className,
}: {
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        compact ? 'mt-4' : 'mt-5',
        'min-w-0 [&>*+*]:mt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SceneAsideRail({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SceneSurface
      as="aside"
      className="[&>*+*]:mt-4 [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-ink/20 [&>*+*]:pt-4"
    >
      {children}
    </SceneSurface>
  );
}

export function GameSceneInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bg-ink/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function GameSceneNote({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-l-2 px-4 py-3 text-sm leading-7',
        tone === 'danger'
          ? 'border-crimson bg-crimson/6 text-crimson'
          : 'border-crimson bg-[rgba(248,243,230,0.88)] text-ink',
        className,
      )}
    >
      {children}
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
    <section className={cn('min-w-0', className)}>
      <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
        {title}
      </div>
      {children}
    </section>
  );
}

function SceneStrip({
  group,
  label,
  contextLabel,
  summary,
}: {
  group: string | null;
  label: string;
  contextLabel: string | null;
  summary: string | null;
}) {
  return (
    <div className="border-battle-rule-strong border-b border-dashed pb-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1 md:gap-x-3">
          <div className="font-heading text-ink text-[1.45rem] leading-none md:text-[1.8rem]">
            {label}
          </div>
          {group ? (
            <>
              <div className="text-battle-muted text-sm leading-none">/</div>
              <div className="text-battle-muted font-sans text-[0.78rem] leading-none tracking-[0.16em] md:text-[0.82rem]">
                {group}
              </div>
            </>
          ) : null}
        </div>
        {contextLabel ? (
          <div className="text-battle-muted mt-2 min-w-0 text-[0.82rem] leading-6 tracking-[0.12em]">
            {contextLabel}
          </div>
        ) : null}
        <div className="text-ink-secondary mt-2 min-w-0 text-sm leading-6">
          {summary ?? '此处事务已收束，按眼前所需行事即可。'}
        </div>
      </div>
    </div>
  );
}

export function GameSceneFrame({
  title,
  description,
  headerMeta,
  aside,
  children,
  variant = 'default',
  contentClassName,
}: GameSceneFrameProps) {
  const matches = useMatches();
  const scene = resolveGameScene(matches);
  const sceneGroup = scene?.group ? sceneGroupLabel[scene.group] : null;
  const header = resolveGameSceneFrameHeader({
    sceneLabel: scene?.label,
    sceneSummary: scene?.summary,
    title,
    description,
  });
  const frameWidthClass = variant === 'lite' ? 'max-w-4xl' : 'max-w-5xl';
  const asideWidthClass =
    variant === 'workflow'
      ? 'lg:grid-cols-[minmax(0,1fr)_280px]'
      : 'lg:grid-cols-[minmax(0,1fr)_240px]';

  return (
    <div className="battle-scroll h-full overflow-y-auto">
      <div
        className={cn(
          'mx-auto w-full px-3 py-3 md:px-6 md:py-4',
          frameWidthClass,
        )}
      >
        <div className={cn('grid gap-4', aside ? asideWidthClass : '')}>
          <SceneSurface>
            <SceneStrip
              group={sceneGroup}
              label={header.label}
              contextLabel={header.contextLabel}
              summary={header.summary}
            />

            {headerMeta ? <div className="mt-4">{headerMeta}</div> : null}

            <SceneBody
              compact={variant !== 'default'}
              className={contentClassName}
            >
              {children}
            </SceneBody>
          </SceneSurface>

          {aside ? <SceneAsideRail>{aside}</SceneAsideRail> : null}
        </div>
      </div>
    </div>
  );
}
