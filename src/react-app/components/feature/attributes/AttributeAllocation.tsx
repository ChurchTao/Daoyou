import { InkButton } from '@app/components/ui/InkButton';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

function AddPoint({
  label,
  disabled,
  add,
}: {
  label: string;
  disabled: boolean;
  add: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const repeated = useRef(false);
  const callback = useRef(add);
  const stop = () => clearTimeout(timer.current);
  useLayoutEffect(() => {
    callback.current = add;
    if (disabled) stop();
  }, [add, disabled]);
  useEffect(() => {
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, []);
  return (
    <button
      type="button"
      aria-label={`增加${label}`}
      disabled={disabled}
      className="border-teal/25 text-teal hover:border-teal/60 hover:bg-teal/10 focus-visible:outline-teal relative inline-flex size-6 shrink-0 touch-none items-center justify-center rounded-xs border font-mono text-base leading-none transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30 pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5"
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) return;
        stop();
        repeated.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        const repeat = () => {
          repeated.current = true;
          callback.current();
          timer.current = setTimeout(repeat, 80);
        };
        timer.current = setTimeout(repeat, 350);
      }}
      onPointerUp={stop}
      onPointerCancel={() => {
        repeated.current = true;
        stop();
      }}
      onLostPointerCapture={stop}
      onBlur={stop}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0 || !repeated.current) add();
        repeated.current = false;
      }}
    >
      +
    </button>
  );
}

/** Controlled draft only; the caller owns domain previews and confirmation/submission. */
export function AttributeAllocation<K extends string>({
  attributes,
  available,
  draft,
  onChange,
  disabled = false,
  onConfirm,
}: {
  attributes: readonly { id: K; label: string; value: number }[];
  available: number;
  draft: Record<K, number>;
  onChange: Dispatch<SetStateAction<Record<K, number>>>;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const total = attributes.reduce(
    (sum, attribute) => sum + draft[attribute.id],
    0,
  );
  return (
    <section className="border-ink/15 border-t pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-teal text-sm">属性加点</h3>
        <span className="text-ink-secondary text-xs" aria-live="polite">
          待分配 <span className="font-mono">{available - total}</span>
          {total > 0 ? (
            <>
              {' '}
              · 已预分配 <span className="font-mono">{total}</span>
            </>
          ) : null}
        </span>
      </div>
      <div
        className={`grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 ${attributes.length === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}
      >
        {attributes.map((attribute) => (
          <div key={attribute.id} className="min-w-0">
            <p className="text-ink-secondary mb-1 text-xs">{attribute.label}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-mono text-sm">
                {attribute.value + draft[attribute.id]}
                {draft[attribute.id] > 0 ? (
                  <span className="text-teal ml-1 text-xs">
                    +{draft[attribute.id]}
                  </span>
                ) : null}
              </p>
              {available > 0 ? (
                <AddPoint
                  label={attribute.label}
                  disabled={disabled || total >= available}
                  add={() =>
                    onChange((previous) => {
                      const used = attributes.reduce(
                        (sum, entry) => sum + previous[entry.id],
                        0,
                      );
                      return used >= available
                        ? previous
                        : {
                            ...previous,
                            [attribute.id]: previous[attribute.id] + 1,
                          };
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {available > 0 ? (
        <div className="mt-3 flex justify-end gap-3">
          <InkButton
            disabled={disabled || total === 0}
            onClick={() =>
              onChange(
                (previous) =>
                  Object.fromEntries(
                    Object.keys(previous).map((key) => [key, 0]),
                  ) as Record<K, number>,
              )
            }
          >
            重置
          </InkButton>
          <InkButton disabled={disabled || total === 0} onClick={onConfirm}>
            确认分配
          </InkButton>
        </div>
      ) : null}
    </section>
  );
}
