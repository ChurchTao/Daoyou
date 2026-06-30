import { InkButton } from '@app/components/ui';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { attrLabel } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { cn } from '@shared/lib/cn';
import type { Attributes } from '@shared/types/cultivator';
import {
  adjustAttributeDraftValue,
  canSubmitAttributeAllocation,
  createEmptyAttributeDraft,
  setAttributeDraftValue,
  sumAttributeDraft,
} from './attributeAllocationControlLogic';

type PrimaryAttributeType =
  | AttributeType.SPIRIT
  | AttributeType.VITALITY
  | AttributeType.SPEED
  | AttributeType.WILLPOWER
  | AttributeType.WISDOM;

const ATTRIBUTE_ORDER: PrimaryAttributeType[] = [
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
  AttributeType.WISDOM,
];

const ATTRIBUTE_KEY_BY_TYPE: Record<PrimaryAttributeType, keyof Attributes> = {
  [AttributeType.SPIRIT]: 'spirit',
  [AttributeType.VITALITY]: 'vitality',
  [AttributeType.SPEED]: 'speed',
  [AttributeType.WILLPOWER]: 'willpower',
  [AttributeType.WISDOM]: 'wisdom',
};

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
  onChange: (draft: Attributes) => void;
  onSubmit: () => void;
}) {
  const pending = sumAttributeDraft(draft);
  const canSubmit = canSubmitAttributeAllocation({
    draft,
    unallocatedPoints,
    loading,
  });

  return (
    <div className="border-ink/15 mb-3 space-y-3 border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink-secondary">
          可分配属性点：{unallocatedPoints}
        </span>
        <span
          className={cn(
            'text-sm',
            pending > unallocatedPoints ? 'text-crimson' : 'text-ink-secondary',
          )}
        >
          本次分配：{pending}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        {ATTRIBUTE_ORDER.map((attrType) => {
          const key = ATTRIBUTE_KEY_BY_TYPE[attrType];
          const draftValue = draft[key];
          return (
            <div key={key} className="text-sm">
              <div className="text-ink-secondary mb-1 flex items-center justify-between gap-2">
                <span>{attrLabel(attrType)}</span>
                <span className="text-xs">
                  {currentAttributes[key]} → {currentAttributes[key] + draftValue}
                </span>
              </div>
              <div className="grid grid-cols-[2rem_1fr_2rem]">
                <button
                  type="button"
                  aria-label={`减少${attrLabel(attrType)}分配`}
                  disabled={draftValue <= 0 || loading}
                  onClick={() =>
                    onChange(adjustAttributeDraftValue(draft, key, -1))
                  }
                  className="border-ink/20 bg-paper text-ink disabled:text-ink-secondary h-9 border text-base leading-none disabled:opacity-40"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={draftValue}
                  disabled={loading}
                  onChange={(event) =>
                    onChange(
                      setAttributeDraftValue(
                        draft,
                        key,
                        Number(event.currentTarget.value),
                      ),
                    )
                  }
                  className="border-ink/20 bg-paper text-ink focus:border-crimson h-9 w-full border-y px-2 text-center outline-none"
                />
                <button
                  type="button"
                  aria-label={`增加${attrLabel(attrType)}分配`}
                  disabled={pending >= unallocatedPoints || loading}
                  onClick={() =>
                    onChange(adjustAttributeDraftValue(draft, key, 1))
                  }
                  className="border-ink/20 bg-paper text-ink disabled:text-ink-secondary h-9 border text-base leading-none disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3">
        <InkButton
          className="text-sm"
          disabled={pending <= 0 || loading}
          onClick={() => onChange(createEmptyAttributeDraft())}
        >
          清空本次
        </InkButton>
        <InkButton
          className="text-sm"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          确认分配
        </InkButton>
      </div>
    </div>
  );
}
