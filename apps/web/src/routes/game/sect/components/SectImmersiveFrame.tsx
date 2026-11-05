import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import type { ReactNode } from 'react';

export function SectImmersiveFrame({
  title,
  description,
  sectName,
  image,
  tone,
  backAction,
  children,
}: {
  title: string;
  description?: string;
  sectName?: string;
  image?: string;
  tone?: string;
  backAction: { label: string; href?: string; onBack?(): void };
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'bg-paper relative isolate h-full overflow-hidden',
        !image && tone,
      )}
    >
      <title>{formatDocumentTitle(title)}</title>
      <div className="relative h-full overflow-x-hidden overflow-y-auto overscroll-contain">
        {image ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[min(34dvh,10rem)] overflow-hidden"
          >
            <GameImage
              src={image}
              alt=""
              className="size-full object-cover object-[center_65%]"
            />
            <div className="from-paper/60 via-paper/90 via-65% to-paper absolute inset-0 bg-linear-to-b" />
          </div>
        ) : null}
        <header className="pointer-events-none sticky top-0 z-20 flex justify-between gap-2 pt-[calc(var(--app-safe-top)+0.65rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)]">
          <InkButton
            variant="secondary"
            href={backAction.href}
            onClick={backAction.onBack}
            className="bg-paper/95 border-ink/15 pointer-events-auto min-h-11 rounded-sm border px-3 shadow-sm backdrop-blur-sm"
          >
            {backAction.label}
          </InkButton>
          {sectName ? (
            <span className="bg-paper/95 border-ink/15 text-ink flex min-h-11 min-w-0 items-center truncate rounded-sm border px-3 text-sm shadow-sm">
              {sectName}
            </span>
          ) : null}
        </header>
        <div className="relative mx-auto w-full max-w-5xl pt-7 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)] pl-[max(env(safe-area-inset-left),1rem)] sm:pt-10 sm:pr-6 sm:pl-6">
          <h1 className="font-heading text-ink text-3xl leading-tight sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="text-ink mt-2 max-w-2xl text-sm leading-7 sm:text-base">
              {description}
            </p>
          ) : null}
          <div className="mt-5 space-y-5 sm:mt-7">{children}</div>
        </div>
      </div>
    </section>
  );
}
