import { InkTag } from '@app/components/ui/InkTag';

export function BeastMutationTag({ isMutant }: { isMutant?: boolean }) {
  return isMutant ? (
    <InkTag className="shrink-0 text-xs text-violet-600">变异</InkTag>
  ) : null;
}
