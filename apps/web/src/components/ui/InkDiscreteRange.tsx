import { cn } from '@app/lib/cn';

const sliderClass =
  'pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-crimson [&::-webkit-slider-thumb]:bg-bgpaper [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-crimson [&::-moz-range-thumb]:bg-bgpaper [&::-moz-range-thumb]:shadow-sm focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-crimson/40 focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-crimson/40';

export function InkDiscreteRange({
  label,
  options,
  min,
  max,
  onChange,
  className,
}: {
  label: string;
  options: readonly string[];
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  className?: string;
}) {
  const last = options.length - 1;
  const collapsed = min === max;
  return (
    <div className={cn('space-y-2', className)} role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-secondary">
          下限 <strong className="text-ink font-medium">{options[min]}</strong>
        </span>
        <span className="text-ink-secondary">
          上限 <strong className="text-ink font-medium">{options[max]}</strong>
        </span>
      </div>
      <div className="relative h-11">
        <div className="relative h-full">
          <div
            className="bg-ink/15 absolute top-1/2 right-3 left-3 h-px"
            aria-hidden="true"
          />
          <div
            className="bg-crimson/70 absolute top-1/2 h-0.5 -translate-y-1/4"
            style={{
              left: `calc(0.75rem + (100% - 1.5rem) * ${min / last})`,
              right: `calc(0.75rem + (100% - 1.5rem) * ${(last - max) / last})`,
            }}
            aria-hidden="true"
          />
          {options.map((option, index) => (
            <span
              key={`${option}-${index}`}
              className={cn(
                'border-ink/35 bg-bgpaper absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border',
                index >= min && index <= max && 'border-crimson/70',
              )}
              style={{
                left: `calc(0.75rem + (100% - 1.5rem) * ${index / last})`,
              }}
              aria-hidden="true"
            />
          ))}
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={min}
            aria-label={`${label}下限`}
            aria-valuetext={options[min]}
            onChange={(event) =>
              onChange(Math.min(Number(event.target.value), max), max)
            }
            className={cn(
              sliderClass,
              'z-20',
              collapsed &&
                '[&::-moz-range-thumb]:-translate-x-1.5 [&::-webkit-slider-thumb]:-translate-x-1.5',
            )}
          />
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={max}
            aria-label={`${label}上限`}
            aria-valuetext={options[max]}
            onChange={(event) =>
              onChange(min, Math.max(Number(event.target.value), min))
            }
            className={cn(
              sliderClass,
              'z-10',
              collapsed &&
                '[&::-moz-range-thumb]:translate-x-1.5 [&::-webkit-slider-thumb]:translate-x-1.5',
            )}
          />
        </div>
      </div>
      <div
        className="text-ink-secondary flex justify-between text-xs"
        aria-hidden="true"
      >
        <span>{options[0]}</span>
        <span>{options[last]}</span>
      </div>
    </div>
  );
}
