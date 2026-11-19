import { PaperSurface } from '@app/components/ui/PaperSurface';
import type { PaperTexture } from '@app/lib/game-setting';
import { useId } from 'react';

const options = [
  { value: 'fine', label: '生宣' },
  { value: 'semi-sized', label: '半熟宣' },
  { value: 'classic', label: '熟宣' },
  { value: 'none', label: '无纹理' },
] as const;

export function PaperTextureChoices({
  value,
  onChange,
}: {
  value: PaperTexture;
  onChange: (value: PaperTexture) => void;
}) {
  const name = `${useId()}-paper-texture`;

  return (
    <fieldset>
      <legend className="text-ink text-sm leading-6">纸底纹理</legend>
      <div className="mt-3 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="min-w-0 cursor-pointer text-center"
          >
            <input
              type="radio"
              name={name}
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
                <span className="text-ink/65 text-base tracking-wider whitespace-nowrap sm:text-lg">
                  万界道友
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
