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
    return spans.map((span, originalIdx) => ({
      id: span.id,
      turn: span.turn,
      type: span.type,
      originalIdx,
      lines: presenter.formatSpan(span)
    })).filter(item => item.lines.length > 0);
  }, [spans, presenter]);

  // 过滤出已经播放过的日志（包括当前动作）
  const visibleLogs = useMemo(() => {
    return formattedLogs.filter(item => item.originalIdx <= currentIndex);
  }, [formattedLogs, currentIndex]);

  // 联动滚动：当可见日志增加时，确保最新一行在视图中心
  useEffect(() => {
    if (visibleLogs.length === 0) return;
    
    const lastId = visibleLogs[visibleLogs.length - 1].id;

    const timer = setTimeout(() => {
      const activeElement = scrollRef.current?.querySelector(`[data-span-id="${lastId}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [visibleLogs]);

  return (
    <div 
      ref={scrollRef} 
      className="h-[40vh] min-h-[300px] overflow-y-auto border border-ink-secondary p-4 bg-white/40 custom-scrollbar font-sans text-sm leading-relaxed relative"
    >
      <div className="space-y-4">
        {visibleLogs.map((item, idx) => {
          const isActive = idx === visibleLogs.length - 1;

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

        {visibleLogs.length === 0 && (
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
