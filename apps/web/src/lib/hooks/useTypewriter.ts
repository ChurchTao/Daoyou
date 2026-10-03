import { useEffect, useRef, useState } from 'react';

export interface TypewriterOptions {
  text: string;
  speed?: number; // 每个字的间隔 (ms)
  onComplete?: () => void;
  startDelay?: number; // 开始前延迟 (ms)
  enabled?: boolean; // 是否启用打字机效果
}

/**
 * 打字机效果 Hook (Optimized)
 * 逐字显示文本，支持自定义速度和完成回调
 * 优化：使用 setTimeout 替代 requestAnimationFrame，逻辑更精简
 */
export function useTypewriter({
  text,
  speed = 80,
  onComplete,
  startDelay = 0,
  enabled = true,
}: TypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const currentIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Update ref when onComplete changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 跳过动画，直接显示完整文本
  const skip = () => {
    clearTimer();
    setDisplayedText(text);
    setIsComplete(true);
    setIsRunning(false);
    currentIndexRef.current = text.length;
    // 不触发 onComplete，因为通常 skip 是用户手动行为
  };

  // 重置状态
  const reset = () => {
    clearTimer();
    setDisplayedText('');
    setIsComplete(false);
    setIsRunning(false);
    currentIndexRef.current = 0;
  };

  useEffect(() => {
    // 清理并在重新运行时重置
    clearTimer();

    if (!enabled) {
      const t = setTimeout(() => {
        setDisplayedText(text);
        setIsComplete(true);
        setIsRunning(false);
        currentIndexRef.current = text.length;
      }, 0);
      return () => clearTimeout(t);
    }

    // 初始化状态 (异步执行以避免 warning)
    const t = setTimeout(() => {
      setDisplayedText('');
      setIsComplete(false);
      setIsRunning(true);
      currentIndexRef.current = 0;

      // 开始延迟
      timerRef.current = setTimeout(typeBot, startDelay);
    }, 0);

    const typeBot = () => {
      // 检查是否完成
      if (currentIndexRef.current >= text.length) {
        setIsComplete(true);
        setIsRunning(false);
        onCompleteRef.current?.();
        return;
      }

      // 打下一个字
      currentIndexRef.current += 1;
      setDisplayedText(text.slice(0, currentIndexRef.current));

      // 预约下一次
      timerRef.current = setTimeout(typeBot, speed);
    };

    return () => {
      clearTimer();
      clearTimeout(t);
    };
  }, [text, speed, startDelay, enabled]);

  return {
    displayedText,
    isComplete,
    isRunning,
    skip,
    reset,
  };
}
