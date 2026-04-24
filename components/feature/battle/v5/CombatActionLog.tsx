'use client';

import { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { LogPresenter } from '@/engine/battle-v5/systems/log/LogPresenter';
import type { LogSpan } from '@/engine/battle-v5/systems/log/types';

interface CombatActionLogProps {
  spans: LogSpan[];
  currentIndex: number;
}

/**
 * 战报展示区：实时高亮当前播放的动作行，并支持自动滚动。
 */
export function CombatActionLog({ spans, currentIndex }: CombatActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 缓存 presenter 实例
  const presenter = useMemo(() => new LogPresenter(), []);

  // 格式化所有 Span 的文本
  const formattedLogs = useMemo(() => {
    return spans.map(span => ({
      id: span.id,
      turn: span.turn,
      type: span.type,
      lines: presenter.formatSpan(span)
    })).filter(item => item.lines.length > 0);
  }, [spans, presenter]);

  // 联动滚动：当索引变化时，确保当前行在视图中心
  useEffect(() => {
    if (currentIndex < 0) return;
    
    // 查找当前 span 在 formattedLogs 中的索引
    const activeId = spans[currentIndex]?.id;
    if (!activeId) return;

    // 延迟一小会儿确保 DOM 已渲染（特别是第一次渲染时）
    const timer = setTimeout(() => {
      const activeElement = scrollRef.current?.querySelector(`[data-span-id="${activeId}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [currentIndex, spans]);

  return (
    <div 
      ref={scrollRef} 
      className="h-[40vh] min-h-[300px] overflow-y-auto border border-ink-secondary p-4 bg-white/40 custom-scrollbar font-sans text-sm leading-relaxed relative"
    >
      <div className="space-y-4">
        {formattedLogs.map((item, idx) => {
          // 确定当前 item 是否对应播放器的 currentIndex
          // 注意：spans 可能包含空 span，而 formattedLogs 过滤掉了空行
          const isActive = spans[currentIndex]?.id === item.id;

          return (
            <div 
              key={item.id} 
              data-span-id={item.id}
              className={cn(
                "group py-2 px-3 transition-all duration-300 border-l-4 border-transparent",
                isActive ? "bg-crimson/5 border-crimson opacity-100 shadow-sm" : "opacity-60 grayscale-[0.5]"
              )}
            >
              {item.lines.map((line, lIdx) => (
                <p 
                  key={lIdx} 
                  className={cn(
                    "text-base md:text-lg",
                    isActive ? "text-ink font-medium" : "text-ink/60"
                  )}
                >
                  <span dangerouslySetInnerHTML={{ __html: line }} />
                </p>
              ))}
            </div>
          );
        })}

        {formattedLogs.length === 0 && (
          <div className="h-full flex items-center justify-center text-ink/30 italic">
            正在推演战局...
          </div>
        )}

        {/* 底部留白，确保最后一行能滚到中心 */}
        <div className="h-32" />
      </div>
    </div>
  );
}
