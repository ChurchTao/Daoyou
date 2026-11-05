import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { createPortal } from 'react-dom';

const MAX_LENGTH = 2000;

/**
 * 笔记本：调查、作答时都能打开，打开时不遮挡操作，可以一边看正文或线索一边记。
 * 宽屏贴在屏幕右缘；窄屏右缘没有空位，入口放在状态栏和推理页底栏。
 */
export function MysteryNotebook({
  text,
  open,
  onOpenChange,
  onChange,
}: {
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (text: string) => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    open ? (
      <section
        aria-label="笔记"
        className={cn(
          'bg-paper border-ink/30 fixed z-[60] flex flex-col gap-2 border p-3 shadow-[0_8px_24px_rgba(44,24,16,0.18)]',
          'inset-x-0 bottom-0 h-[45dvh] border-x-0 border-b-0',
          'lg:inset-x-auto lg:right-6 lg:bottom-6 lg:h-80 lg:w-96 lg:border',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">笔记</h2>
          <InkButton variant="ghost" onClick={() => onOpenChange(false)}>
            收起
          </InkButton>
        </div>
        <textarea
          autoFocus
          aria-label="笔记内容"
          value={text}
          maxLength={MAX_LENGTH}
          placeholder="随手记下疑点、推断和想再查的地方……"
          className="border-ink/20 focus:border-ink min-h-0 w-full flex-1 resize-none border bg-transparent p-2 text-base leading-7 outline-none"
          onChange={(event) => onChange(event.target.value)}
        />
      </section>
    ) : (
      <button
        type="button"
        aria-label={text ? '打开笔记（已有内容）' : '打开笔记'}
        className="bg-paper border-ink/30 hover:text-crimson fixed top-[38%] right-0 z-[60] hidden border border-r-0 px-1 py-2 text-sm tracking-[0.3em] [writing-mode:vertical-rl] lg:block"
        onClick={() => onOpenChange(true)}
      >
        笔记
        {text ? (
          <span
            aria-hidden
            className="bg-crimson mt-1 inline-block size-1.5 rounded-full"
          />
        ) : null}
      </button>
    ),
    document.body,
  );
}
