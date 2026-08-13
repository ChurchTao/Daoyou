import { InkButton } from '@app/components/ui';
import type { ReactNode } from 'react';

export function AlchemyToolWorkspace({
  title,
  backLabel,
  onBack,
  backDisabled = false,
  children,
}: {
  title: string;
  backLabel: string;
  onBack(): void;
  backDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-ink/20 min-h-[34rem] border bg-[rgba(248,243,230,0.42)]">
      <header className="border-ink/10 bg-[rgba(248,243,230,0.94)] sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b px-4 py-3 backdrop-blur-sm sm:px-6">
        <InkButton variant="secondary" onClick={onBack} disabled={backDisabled}>
          ← {backLabel}
        </InkButton>
        <h2 className="min-w-0 flex-1 text-right text-base font-normal sm:text-lg">
          {title}
        </h2>
      </header>
      <div className="px-4 py-6 sm:px-7 sm:py-8">{children}</div>
    </section>
  );
}
