'use client';

import { InkBadge, InkListItem } from '@/components/ui';
import { useEffect, useState } from 'react';

interface LifespanStatus {
  dailyLimit: number;
  consumed: number;
  remaining: number;
  isInRetreat: boolean;
}

interface LifespanStatusCardProps {
  cultivatorId: string;
  /**
   * 是否显示标题
   * @default true
   */
  showTitle?: boolean;
  /**
   * 自定义标题
   * @default "⏳ 今日修炼体力"
   */
  title?: string;
  /**
   * 是否自动刷新
   * @default false
   */
  autoRefresh?: boolean;
  /**
   * 自动刷新间隔（毫秒）
   * @default 60000 (1分钟)
   */
  refreshInterval?: number;
  /**
   * 状态加载完成回调
   */
  onStatusLoaded?: (status: LifespanStatus) => void;
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 寿元消耗状态卡片组件
 * 显示角色今日寿元消耗情况，包括已消耗、剩余、进度条等
 */
export function LifespanStatusCard({
  cultivatorId,
  showTitle = true,
  title = '⏳ 今日使用寿元',
  autoRefresh = false,
  refreshInterval = 60000,
  onStatusLoaded,
  className = '',
}: LifespanStatusCardProps) {
  const [status, setStatus] = useState<LifespanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!cultivatorId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/cultivators/lifespan-status?cultivatorId=${cultivatorId}`,
      );
      const result = await res.json();

      if (result.success && result.data) {
        setStatus(result.data);
        onStatusLoaded?.(result.data);
      } else {
        throw new Error(result.error || '获取寿元状态失败');
      }
    } catch (err) {
      console.error('获取寿元状态失败:', err);
      setError(err instanceof Error ? err.message : '获取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh && refreshInterval > 0) {
      const timer = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultivatorId, autoRefresh, refreshInterval]);

  // 计算寿元使用百分比
  const percentage = status
    ? Math.round((status.consumed / status.dailyLimit) * 100)
    : 0;

  // 根据消耗比例确定颜色
  const getColor = () => {
    if (percentage >= 90) return 'text-crimson';
    if (percentage >= 70) return 'text-amber-600';
    return 'text-ink';
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-crimson';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-ink';
  };

  if (loading && !status) {
    return (
      <div className={`text-sm opacity-60 text-center py-2 ${className}`}>
        正在查询寿元状态...
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={`text-sm text-crimson text-center py-2 ${className}`}>
        {error}
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const textColor = getColor();
  const progressColor = getProgressColor();

  const content = (
    <InkListItem
      title={
        showTitle ? (
          <div className="flex items-center justify-between">
            <span>{title}</span>
            {status.isInRetreat && <InkBadge tier="筑基">闭关中</InkBadge>}
          </div>
        ) : undefined
      }
      description={
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-70">
              已消耗：
              <span className={`font-bold ${textColor}`}>
                {status.consumed}年
              </span>
            </span>
            <span className="opacity-70">
              剩余：
              <span className={`font-bold ${textColor}`}>
                {status.remaining}年
              </span>
            </span>
          </div>

          {/* 进度条 */}
          <div className="w-full h-2 bg-ink/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${progressColor}`}
              style={{
                width: `${Math.min(percentage, 100)}%`,
              }}
            />
          </div>

          {/* 提示文本 */}
          <div className="text-xs opacity-60 text-center">
            每日上限：{status.dailyLimit}年（每日凌晨重置）
          </div>
        </div>
      }
    />
  );

  return className ? <div className={className}>{content}</div> : content;
}

/**
 * 紧凑版寿元状态卡片（仅显示进度条和数值，不显示标题）
 */
export function LifespanStatusCompact({
  cultivatorId,
  className = '',
}: {
  cultivatorId: string;
  className?: string;
}) {
  return (
    <LifespanStatusCard
      cultivatorId={cultivatorId}
      showTitle={false}
      className={className}
    />
  );
}

/**
 * 带自动刷新的寿元状态卡片
 */
export function LifespanStatusLive({
  cultivatorId,
  refreshInterval = 30000,
  className = '',
}: {
  cultivatorId: string;
  refreshInterval?: number;
  className?: string;
}) {
  return (
    <LifespanStatusCard
      cultivatorId={cultivatorId}
      autoRefresh
      refreshInterval={refreshInterval}
      className={className}
    />
  );
}
