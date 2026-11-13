import { InkButton } from '@app/components/ui/InkButton';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { cn } from '@app/lib/cn';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

export interface ChatTextComposerProps {
  inputId: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  maxChars: number;
  placeholder: string;
  label: string;
  posting: boolean;
  cooldownRemaining?: number;
  sendDisabled?: boolean;
  reply?: ReactNode;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  leading?: ReactNode;
}

export function ChatTextComposer({
  inputId,
  inputRef,
  draft,
  maxChars,
  placeholder,
  label,
  posting,
  cooldownRemaining = 0,
  sendDisabled = false,
  reply,
  onDraftChange,
  onSend,
  leading,
}: ChatTextComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const charCount = Array.from(draft).length;
  const cannotSend =
    !draft.trim() || posting || cooldownRemaining > 0 || sendDisabled;

  useLayoutEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(128, Math.max(44, input.scrollHeight))}px`;
  }, [draft, textareaRef]);

  return (
    <div>
      {reply}
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        ref={textareaRef}
        rows={1}
        value={draft}
        placeholder={placeholder}
        className={cn(
          inkFieldVariants({ variant: 'underlined', size: 'sm' }),
          'battle-scroll h-auto max-h-32 resize-none py-2',
        )}
        onChange={(event) =>
          onDraftChange(
            Array.from(event.target.value).slice(0, maxChars).join(''),
          )
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            !matchMedia('(pointer: coarse)').matches
          ) {
            event.preventDefault();
            if (!cannotSend) onSend();
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
        <div className="flex items-center gap-1">{leading}</div>
        <div className="flex items-center gap-2">
          {charCount >= Math.max(0, maxChars - 20) ? (
            <span className="text-ink-secondary font-mono text-xs">
              {charCount}/{maxChars}
            </span>
          ) : null}
          <InkButton
            variant="primary"
            className="min-h-11"
            onClick={onSend}
            disabled={cannotSend}
          >
            {cooldownRemaining > 0 ? `${cooldownRemaining}s` : '发送'}
          </InkButton>
        </div>
      </div>
    </div>
  );
}
