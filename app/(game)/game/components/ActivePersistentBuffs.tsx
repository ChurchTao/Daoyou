'use client';

import { InkButton } from '@/components/ui/InkButton';
import { InkListItem } from '@/components/ui/InkList';
import {
  buffHasAction,
  getBuffDisplayConfig,
} from '@/lib/config/persistentBuffDisplay';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { fetchJsonCached } from '@/lib/client/requestCache';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PersistentBuffStatus {
  id: string;
  instanceId: string;
  name: string;
  icon: string;
  description: string;
  usesRemaining?: number;
  expiresAt?: number;
}

/**
 * Format remaining time for display
 * @param expiresAt - Expiration timestamp in milliseconds
 * @returns Formatted time string (e.g., "3日", "12时", "30分", "已过期")
 */
function formatRemainingTime(expiresAt: number | undefined): string {
  if (!expiresAt || expiresAt <= 0) return '永久';

  const now = Date.now();
  const remaining = expiresAt - now;

  if (remaining <= 0) return '已过期';

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor(remaining / (60 * 1000));

  if (days >= 1) return `${days}日`;
  if (hours >= 1) return `${hours}时`;
  return `${minutes}分`;
}

/**
 * 激活的持久Buff状态
 * 在首页显示当前激活的持久效果（符箓、丹药、伤势等），参考 LifespanStatusCard 的紧凑设计
 */
export function ActivePersistentBuffs() {
  const [buffs, setBuffs] = useState<PersistentBuffStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { cultivator } = useCultivator();

  useEffect(() => {
    let cancelled = false;

    const fetchBuffs = async () => {
      if (!cultivator) return;

      setLoading(true);
      try {
        const data = await fetchJsonCached<{ buffs?: PersistentBuffStatus[] }>(
          '/api/cultivator/persistent-buffs',
          {
            key: `home:persistent-buffs:${cultivator.id}`,
            ttlMs: 30 * 1000,
          },
        );
        if (cancelled) return;
        if (data.buffs) {
          setBuffs(data.buffs);
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    fetchBuffs();

    return () => {
      cancelled = true;
    };
  }, [cultivator]);

  if (loading && buffs.length === 0) {
    return (
      <InkListItem
        title="✨ 激活道韵"
        description={
          <div className="py-2 text-center text-sm opacity-60">
            正在探查道韵...
          </div>
        }
      />
    );
  }

  if (buffs.length === 0) return null;

  return (
    <InkListItem
      title={
        <div className="flex items-center justify-between">
          <span>✨ 激活道韵</span>
          <span className="text-sm opacity-60">{buffs.length}个效果生效中</span>
        </div>
      }
      description={
        <div className="mt-2 space-y-2">
          {buffs.map((buff) => {
            const config = getBuffDisplayConfig(buff.id);
            const hasAction = buffHasAction(buff.id);

            return (
              <div
                key={buff.instanceId}
                className="bg-ink/5 hover:bg-ink/10 flex items-center justify-between rounded p-2 transition-colors"
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xl">{buff.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{buff.name}</span>
                    <span className="text-xs opacity-60">
                      {config?.shortDesc || buff.description}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {/* Show remaining time if has expiry */}
                  {(config?.showExpiry !== false || buff.expiresAt) &&
                    buff.expiresAt !== undefined && (
                      <div className="text-right">
                        <div className="opacity-60">剩余</div>
                        <div className="text-ink-primary font-bold">
                          {formatRemainingTime(buff.expiresAt)}
                        </div>
                      </div>
                    )}
                  {/* Show uses remaining if has uses */}
                  {(config?.showUses !== false || buff.usesRemaining) &&
                    buff.usesRemaining !== undefined &&
                    buff.usesRemaining > 0 && (
                      <div className="text-right">
                        <div className="opacity-60">机缘</div>
                        <div className="text-ink-primary font-bold">
                          {buff.usesRemaining}次
                        </div>
                      </div>
                    )}
                  {/* Show action button if configured */}
                  {hasAction && config?.action && config.path && (
                    <InkButton
                      variant="primary"
                      onClick={() => router.push(config.path!)}
                    >
                      {config.action}
                    </InkButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      }
    />
  );
}
