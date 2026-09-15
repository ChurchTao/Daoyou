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
    <section className="space-y-4 text-sm">
      <header className="border-ink/10 flex items-center justify-between gap-3 border-b pb-3">
        <h3 className="font-medium">{title}</h3>
        <InkButton onClick={onBack} disabled={backDisabled}>
          返回{backLabel}
        </InkButton>
      </header>
      {children}
    </section>
  );
}
