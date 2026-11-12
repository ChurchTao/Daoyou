import { PaperSurface } from '@app/components/ui/PaperSurface';
import type { PaperTexture } from '@app/lib/game-setting';
import { useId } from 'react';

const options: readonly { value: PaperTexture; label: string }[] = [
  { value: 'fine', label: '细腻生宣' },
  { value: 'classic', label: '古朴熟宣' },
  { value: 'none', label: '无' },
];

export function PaperTextureChoices({
  value,
  onChange,
}: {
  value: PaperTexture;
  onChange: (value: PaperTexture) => void;
}) {
  const id = useId();

  return (
    <fieldset aria-describedby={`${id}-description`}>
      <legend className="text-ink text-sm leading-6">纸底纹理</legend>
      <p
        id={`${id}-description`}
        className="text-ink-secondary mt-1 text-xs leading-5"
      >
        选择喜欢的纸张质感，立即生效并保存在本机。
      </p>
      <div className="mt-3 grid max-w-lg grid-cols-3 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="min-w-0 cursor-pointer text-center"
          >
            <input
              type="radio"
              name={`${id}-paper-texture`}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="border-ink/20 peer-checked:border-crimson peer-focus-visible:outline-crimson block overflow-hidden rounded-sm border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
              <PaperSurface
                as="span"
                texture={option.value}
                className="flex h-20 flex-col items-center justify-center gap-2"
                aria-hidden="true"
              >
                <span className="text-ink/65 text-lg tracking-[0.2em]">
                  万界
                </span>
                <span className="border-ink/20 w-10 border-t" />
              </PaperSurface>
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
