import { AttributeAllocation } from '@app/components/feature/attributes/AttributeAllocation';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/cultivatorDisplay';
import type { Attributes } from '@shared/types/cultivator';
import type { Dispatch, SetStateAction } from 'react';

export function AttributeAllocationControl({
  currentAttributes,
  unallocatedPoints,
  draft,
  loading = false,
  onChange,
  onSubmit,
}: {
  currentAttributes: Attributes;
  unallocatedPoints: number;
  draft: Attributes;
  loading?: boolean;
  onChange: Dispatch<SetStateAction<Attributes>>;
  onSubmit: () => void;
}) {
  return (
    <AttributeAllocation
      attributes={(
        Object.keys(CHARACTER_ATTRIBUTE_LABELS) as (keyof Attributes)[]
      ).map((id) => ({
        id,
        label: CHARACTER_ATTRIBUTE_LABELS[id],
        value: currentAttributes[id],
      }))}
      available={unallocatedPoints}
      draft={draft}
      onChange={onChange}
      disabled={loading}
      onConfirm={onSubmit}
    />
  );
}
