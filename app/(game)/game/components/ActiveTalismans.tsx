'use client';

import { InkButton, InkListItem } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCultivator } from '@/lib/contexts/CultivatorContext';

interface TalismanStatus {
  id: string;
  instanceId: string;
  name: string;
  remainingDays: number;
  usesRemaining: number;
  expiresAt: number;
}

/**
 * 激活的符箓状态
 * 在首页显示当前激活的符箓效果，参考 LifespanStatusCard 的紧凑设计
 */
export function ActiveTalismans() {
  const [talismans, setTalismans] = useState<TalismanStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { cultivator } = useCultivator();

  useEffect(() => {
    const fetchTalismans = async () => {
      if (!cultivator) return;

      setLoading(true);
      try {
        const res = await fetch('/api/cultivator/talismans');
        const data = await res.json();
        if (data.talismans) {
          setTalismans(data.talismans);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchTalismans();
  }, [cultivator]);

  if (loading && talismans.length === 0) {
    return (
      <InkListItem
        title="✨ 激活道韵"
        description={
          <div className="text-sm opacity-60 text-center py-2">
            正在探查道韵...
          </div>
        }
      />
    );
  }

  if (talismans.length === 0) return null;

  // 根据符箓类型获取图标和目标路径
  const getTalismanInfo = (id: string) => {
    if (id === 'reshape_fate_talisman') {
      return {
        icon: '🔮',
        path: '/game/fate-reshape',
        action: '推演命格',
        shortDesc: '可窥探三条未来命数',
      };
    }
    if (id === 'draw_gongfa_talisman') {
      return {
        icon: '📜',
        path: '/game/manual-draw?type=gongfa',
        action: '感悟功法',
        shortDesc: '可领悟功法典籍',
      };
    }
    if (id === 'draw_skill_talisman') {
      return {
        icon: '⚡',
        path: '/game/manual-draw?type=skill',
        action: '衍化神通',
        shortDesc: '可衍化神通秘术',
      };
    }
    return {
      icon: '📜',
      path: '/game',
      action: '查看',
      shortDesc: '特殊效果',
    };
  };

  return (
    <InkListItem
      title={
        <div className="flex items-center justify-between">
          <span>✨ 激活道韵</span>
          <span className="text-sm opacity-60">{talismans.length}个符箓生效中</span>
        </div>
      }
      description={
        <div className="mt-2 space-y-2">
          {talismans.map((talisman) => {
            const info = getTalismanInfo(talisman.id);
            return (
              <div
                key={talisman.instanceId}
                className="flex items-center justify-between p-2 bg-ink/5 rounded hover:bg-ink/10 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xl">{info.icon}</span>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{talisman.name}</span>
                    <span className="text-xs opacity-60">{info.shortDesc}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <div className="opacity-60">剩余</div>
                    <div className="font-bold text-ink-primary">{talisman.remainingDays}日</div>
                  </div>
                  {talisman.usesRemaining > 0 && (
                    <div className="text-right">
                      <div className="opacity-60">机缘</div>
                      <div className="font-bold text-ink-primary">{talisman.usesRemaining}次</div>
                    </div>
                  )}
                  <InkButton
                    variant="primary"
                    onClick={() => router.push(info.path)}
                  >
                    {info.action}
                  </InkButton>
                </div>
              </div>
            );
          })}
        </div>
      }
    />
  );
}
