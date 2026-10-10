export interface InkQuantityInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  max: number;
  min?: number;
  disabled?: boolean;
}

export function InkQuantityInput({
  label,
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
}: InkQuantityInputProps) {
  const quantity = Number(value);
  const valid = value !== '' && Number.isInteger(quantity);
  const unavailable = disabled || max < min;
  const step = (delta: number) => {
    const next = valid ? quantity + delta : min;
    onChange(String(Math.max(min, Math.min(max, next))));
  };

  return (
    <div
      role="group"
      aria-label={`${label}，最多${max}`}
      className="border-ink/20 inline-flex h-9 max-w-full items-center border text-base"
    >
      <button
        type="button"
        aria-label={`减少${label}`}
        disabled={unavailable || (valid && quantity <= min)}
        onClick={() => step(-1)}
        className="disabled:text-ink-secondary/50 h-full w-9 shrink-0 cursor-pointer disabled:cursor-default"
      >
        −
      </button>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={value}
        disabled={unavailable}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: `${Math.max(3, String(max).length + 1)}ch` }}
        className="border-ink/20 h-full min-w-0 [appearance:textfield] border-x bg-transparent text-center font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={`增加${label}`}
        disabled={unavailable || (valid && quantity >= max)}
        onClick={() => step(1)}
        className="disabled:text-ink-secondary/50 h-full w-9 shrink-0 cursor-pointer disabled:cursor-default"
      >
        +
      </button>
      <button
        type="button"
        aria-label={`设为最多${max}`}
        disabled={unavailable || (valid && quantity === max)}
        onClick={() => onChange(String(max))}
        className="border-ink/20 disabled:text-ink-secondary/50 h-full shrink-0 cursor-pointer border-l px-1.5 disabled:cursor-default"
      >
        最多
      </button>
    </div>
  );
}
