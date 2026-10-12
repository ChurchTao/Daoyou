import { cn } from '@app/lib/cn';
import { useId } from 'react';
import './ink-node-slider.css';

/** Discrete choices use equal spacing, even when their numeric values differ. */
export function InkNodeSlider({
  label,
  values,
  value,
  onChange,
  disabled = false,
  unit,
}: {
  label: string;
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  unit?: string;
}) {
  const id = useId();
  const index = values.indexOf(value);
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="text-crimson">
          <span className="font-mono text-xl">{value}</span> {unit}
        </output>
      </div>
      <div className="relative mx-5 h-9">
        <div className="border-ink/25 absolute inset-x-0 top-4 border-t" />
        <div
          className="absolute inset-x-0 top-4 flex justify-between"
          aria-hidden="true"
        >
          {values.map((node, position) => (
            <span
              key={node}
              className={cn(
                'bg-bgpaper border-ink/40 -mt-1 h-2 w-2 rounded-full border',
                position === index && 'border-crimson bg-crimson',
              )}
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={index}
          aria-valuetext={`${value}${unit ?? ''}`}
          disabled={disabled}
          onChange={(event) => onChange(values[Number(event.target.value)]!)}
          className="ink-node-slider absolute top-0 -left-2 h-9 w-[calc(100%+1rem)] cursor-pointer disabled:cursor-default disabled:opacity-50"
        />
      </div>
      <div className="mx-5 flex justify-between">
        {values.map((node) => (
          <button
            key={node}
            type="button"
            aria-label={`选择${node}${unit ?? ''}`}
            aria-pressed={node === value}
            disabled={disabled}
            onClick={() => onChange(node)}
            className="text-ink-secondary aria-pressed:text-crimson -mx-5 min-h-10 w-10 cursor-pointer text-center font-mono text-sm disabled:cursor-default disabled:opacity-50"
          >
            {node}
          </button>
        ))}
      </div>
    </div>
  );
}
