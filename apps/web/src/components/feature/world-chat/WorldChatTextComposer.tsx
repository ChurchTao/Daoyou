import { InkButton } from '@app/components/ui/InkButton';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { cn } from '@app/lib/cn';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import { type ReactNode, type RefObject } from 'react';
import { getWorldChatMessageBody } from './worldChatSummary';

export function WorldChatTextComposer({
  inputId,
  inputRef,
  draft,
  maxChars,
  placeholder,
  label,
  posting,
  cooldownRemaining,
  sendDisabled = false,
  reply,
  onDraftChange,
  onClearReply,
  onSend,
  leading,
}: {
  inputId: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  maxChars: number;
  placeholder: string;
  label: string;
  posting: boolean;
  cooldownRemaining: number;
  sendDisabled?: boolean;
  reply: WorldChatMessageDTO | null;
  onDraftChange: (draft: string) => void;
  onClearReply: () => void;
  onSend: () => void;
  leading?: ReactNode;
}) {
  const charCount = Array.from(draft).length;

  return (
    <div>
      {reply ? (
        <div className="border-teal bg-ink/4 mb-2 flex min-w-0 items-center gap-2 border-l-2 px-3 py-1">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-teal">回复 {reply.senderName}</p>
            <p className="text-ink-secondary truncate">
              {getWorldChatMessageBody(reply)}
            </p>
          </div>
          <InkButton
            className="min-h-11"
            variant="secondary"
            onClick={onClearReply}
          >
            取消
          </InkButton>
        </div>
      ) : null}
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
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
            onSend();
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
            disabled={
              !draft.trim() || posting || cooldownRemaining > 0 || sendDisabled
            }
          >
            {cooldownRemaining > 0 ? `${cooldownRemaining}s` : '发送'}
          </InkButton>
        </div>
      </div>
    </div>
  );
}
