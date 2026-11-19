import { cn } from '@app/lib/cn';
import type { ColorScheme } from '@app/lib/game-setting';
import { useId } from 'react';

const options = [
  { value: 'system', label: '跟随系统', previews: ['light', 'dark'] },
  { value: 'light', label: '亮色', previews: ['light'] },
  { value: 'dark', label: '暗色', previews: ['dark'] },
] as const;

export function AppearanceChoices({
  value,
  onChange,
}: {
  value: ColorScheme;
  onChange: (value: ColorScheme) => void;
}) {
  const id = useId();

  return (
    <fieldset>
      <legend className="text-ink text-sm leading-6">外观主题</legend>
      <div className="mt-3 grid max-w-md grid-cols-3 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="min-w-0 cursor-pointer text-center"
          >
            <input
              type="radio"
              name={`${id}-color-scheme`}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="border-ink/20 peer-checked:border-crimson peer-focus-visible:outline-crimson flex aspect-[8/5] overflow-hidden rounded-sm border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
            >
              {option.previews.map((theme) => (
                <span
                  key={theme}
                  data-theme-preview={theme}
                  className="relative flex-1 overflow-hidden bg-(--theme-sheet)"
                >
                  <span
                    className={cn(
                      'absolute top-1/2 flex -translate-1/2 flex-col items-center gap-1.5 font-mono text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap text-(--theme-ink) after:h-px after:w-5 after:bg-(--theme-crimson) sm:text-xs',
                      option.value === 'system'
                        ? theme === 'light'
                          ? 'left-full'
                          : 'left-0'
                        : 'left-1/2',
                    )}
                  >
                    DAOYOU.ORG
                  </span>
                </span>
              ))}
            </span>
            <span className="text-ink-secondary peer-checked:text-crimson mt-2 block text-sm leading-6 peer-checked:font-medium">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
