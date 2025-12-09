import { TypewriterOptions, useTypewriter } from '@/lib/hooks/useTypewriter';
import { cn } from '@/lib/utils';

interface TypewriterTextProps extends Omit<TypewriterOptions, 'onComplete'> {
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean; // 是否显示光标
  cursorChar?: string; // 光标字符
  vertical?: boolean; // 是否竖排
}

/**
 * 打字机效果文本组件
 * 逐字显示文本，支持竖排和光标显示
 */
export function TypewriterText({
  text,
  speed = 80,
  startDelay = 0,
  enabled = true,
  className,
  onComplete,
  showCursor = false,
  cursorChar = '▌',
  vertical = false,
}: TypewriterTextProps) {
  const { displayedText, isComplete, isRunning } = useTypewriter({
    text,
    speed,
    startDelay,
    enabled,
    onComplete,
  });

  return (
    <span
      className={cn(
        'inline-block whitespace-pre-wrap',
        vertical && 'writing-mode-vertical',
        className,
      )}
    >
      {displayedText}
      {showCursor && isRunning && !isComplete && (
        <span className="animate-pulse opacity-70">{cursorChar}</span>
      )}
    </span>
  );
}
