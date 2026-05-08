'use client';

import { FateDetailModal } from '@/components/feature/fates/FateDetailModal';
import { FateEffectInlineList } from '@/components/feature/fates/FateEffectInlineList';
import { toFateDisplayModel } from '@/components/feature/fates/FateDisplayAdapter';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkButton,
  InkCard,
  InkList,
  InkNotice,
  InkTag,
  ItemCard,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { PreHeavenFate } from '@/types/cultivator';
import type { FateReshapeSessionDTO } from '@/types/fateReshape';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SessionResponse = {
  success: boolean;
  data?: {
    session: FateReshapeSessionDTO | null;
    talismanCount: number;
  };
  error?: string;
};

type SessionMutationResponse = {
  success: boolean;
  data?: {
    session?: FateReshapeSessionDTO;
    talismanCount?: number;
  };
  error?: string;
};

type ConfirmResponse = {
  success: boolean;
  error?: string;
};

function formatExpireTime(expiresAt: number): string {
  return new Date(expiresAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FateReshapePage() {
  const pathname = usePathname();
  const { cultivator, note, isLoading, refreshCultivator, refreshInventory } =
    useCultivator();
  const { pushToast } = useInkUI();
  const [session, setSession] = useState<FateReshapeSessionDTO | null>(null);
  const [talismanCount, setTalismanCount] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [detailFate, setDetailFate] = useState<PreHeavenFate | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'start' | 'reroll' | 'confirm' | 'abandon' | null
  >(null);
  const [isBooting, setIsBooting] = useState(true);

  const loadSession = useCallback(async (showErrorToast = true) => {
    if (!cultivator) {
      setIsBooting(false);
      return;
    }

    setIsBooting(true);
    try {
      const response = await fetch('/api/fate-reshape/session');
      const result = (await response.json()) as SessionResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '获取命格重塑状态失败');
      }

      setSession(result.data.session);
      setTalismanCount(result.data.talismanCount);
      setSelectedIndices([]);
    } catch (error) {
      if (showErrorToast) {
        pushToast({
          message:
            error instanceof Error ? error.message : '获取命格重塑状态失败',
          tone: 'danger',
        });
      }
    } finally {
      setIsBooting(false);
    }
  }, [cultivator, pushToast]);

  useEffect(() => {
    void loadSession(false);
  }, [loadSession]);

  const currentFates = useMemo(
    () => session?.originalFates ?? cultivator?.pre_heaven_fates ?? [],
    [cultivator?.pre_heaven_fates, session],
  );
  const candidateFates = session?.currentCandidates ?? [];

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((item) => item !== index);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, index];
    });
  };

  const handleStart = async () => {
    setPendingAction('start');
    try {
      const response = await fetch('/api/fate-reshape/session', {
        method: 'POST',
      });
      const result = (await response.json()) as SessionMutationResponse;

      if (!response.ok || !result.success || !result.data?.session) {
        throw new Error(result.error || '开启命格重塑失败');
      }

      setSession(result.data.session);
      setTalismanCount(result.data.talismanCount ?? talismanCount);
      setSelectedIndices([]);
      pushToast({
        message: '天机已启，本次命格重塑正式开始。',
        tone: 'success',
      });
      await refreshInventory(['consumables']);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '开启命格重塑失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleReroll = async () => {
    setPendingAction('reroll');
    try {
      const response = await fetch('/api/fate-reshape/reroll', {
        method: 'POST',
      });
      const result = (await response.json()) as SessionMutationResponse;

      if (!response.ok || !result.success || !result.data?.session) {
        throw new Error(result.error || '命格重抽失败');
      }

      setSession(result.data.session);
      setSelectedIndices([]);
      pushToast({
        message: '天机再转，命格候选已重置。',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '命格重抽失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleConfirm = async () => {
    if (selectedIndices.length !== 3) {
      pushToast({ message: '请选择 3 个命格进行替换。', tone: 'warning' });
      return;
    }

    setPendingAction('confirm');
    try {
      const response = await fetch('/api/fate-reshape/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIndices }),
      });
      const result = (await response.json()) as ConfirmResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '确认命格重塑失败');
      }

      setSession(null);
      setSelectedIndices([]);
      await refreshCultivator();
      await loadSession(false);
      pushToast({
        message: '新命格已落定，道身气数已全量重塑。',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '确认命格重塑失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleAbandon = async () => {
    setPendingAction('abandon');
    try {
      const response = await fetch('/api/fate-reshape/abandon', {
        method: 'POST',
      });
      const result = (await response.json()) as ConfirmResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '放弃命格重塑失败');
      }

      setSession(null);
      setSelectedIndices([]);
      pushToast({
        message: '本次命格重塑已作罢，原命格保持不变。',
        tone: 'success',
      });
      await loadSession(false);
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '放弃命格重塑失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">命格天机推演中……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【命格重塑】"
        subtitle="需先踏入仙途，方能拨动天机"
        backHref="/game"
        currentPath={pathname}
      >
        <InkNotice>当前没有活跃角色，暂无法进行命格重塑。</InkNotice>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell
      title="【命格重塑】"
      subtitle="遮蔽天机，逆转先天之数"
      backHref="/game/cultivator"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/cultivator">返回道我真形</InkButton>
          <InkButton href="/game/inventory" variant="secondary">
            返回储物袋
          </InkButton>
          <InkButton href="/game" variant="secondary">
            返回主界
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【当前命格】">
        {currentFates.length === 0 ? (
          <InkNotice>当前道身暂无先天命格可供重塑。</InkNotice>
        ) : (
          <InkList>
            {currentFates.map((fate, idx) => {
              const fateDisplay = toFateDisplayModel(fate);
              return (
                <ItemCard
                  key={`${fate.name}-${idx}`}
                  name={fate.name}
                  quality={fate.quality}
                  meta={<FateEffectInlineList lines={fateDisplay.previewLines} />}
                  description={fate.description}
                  actions={
                    <InkButton
                      variant="secondary"
                      onClick={() => setDetailFate(fate)}
                    >
                      详情
                    </InkButton>
                  }
                  layout="col"
                />
              );
            })}
          </InkList>
        )}
      </InkSection>

      {isBooting && !session ? (
        <InkSection title="【开始重塑】">
          <InkNotice>正在校验未完成的命格重塑会话……</InkNotice>
        </InkSection>
      ) : !session ? (
        <InkSection title="【开始重塑】">
          <InkCard variant="elevated" padding="lg" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-ink/10 rounded-md border px-3 py-2">
                <div className="text-ink-secondary text-xs">天机逆命符</div>
                <div className="text-ink text-lg font-semibold">
                  {talismanCount} 张
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm leading-6">
              <p>点击下方按钮后，会立刻消耗 1 张天机逆命符。</p>
              <p>天道会为你重塑 6 个新命格，你要从里面选 3 个</p>
              <p>确认后，你现在的 3 个命格会被这 3 个新命格直接替换，也可以直接放弃，消耗不会返还。</p>
            </div>
            {talismanCount <= 0 && (
              <InkNotice tone="warning">
                你现在没有天机逆命符，暂时不能开始重塑命格。
              </InkNotice>
            )}
            <InkActionGroup align="center">
              <InkButton
                variant="primary"
                onClick={handleStart}
                disabled={pendingAction !== null || talismanCount <= 0}
              >
                {pendingAction === 'start'
                  ? '启封中…'
                  : '消耗 1 张天机逆命符，开启重塑'}
              </InkButton>
            </InkActionGroup>
          </InkCard>
        </InkSection>
      ) : (
        <>
          <InkSection title="【当前进度】">
            <InkCard variant="elevated" padding="lg" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border-ink/10 rounded-md border px-3 py-2">
                  <div className="text-ink-secondary text-xs">还能重塑</div>
                  <div className="text-ink text-lg font-semibold">
                    {session.canReroll ? '1 次' : '0 次'}
                  </div>
                </div>
                <div className="border-ink/10 rounded-md border px-3 py-2">
                  <div className="text-ink-secondary text-xs">天机将于此失效</div>
                  <div className="text-ink text-lg font-semibold">
                    {formatExpireTime(session.expiresAt)}
                  </div>
                </div>
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                你已经开始本次重塑。离开页面后，下次回来还能继续重塑，
                直到你确认、放弃，或者天机失效。
              </p>
            </InkCard>
          </InkSection>

          <InkSection title="【命格候选】">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-ink-secondary text-sm">{`已选 ${selectedIndices.length}/3`}</span>
              <div className="flex flex-wrap items-center gap-2">
                <InkButton
                  variant="secondary"
                  onClick={handleReroll}
                  disabled={pendingAction !== null || !session.canReroll}
                >
                  {pendingAction === 'reroll' ? '重塑中…' : '再次重塑'}
                </InkButton>
                <InkButton
                  variant="secondary"
                  onClick={handleAbandon}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === 'abandon' ? '放弃中…' : '放弃重塑'}
                </InkButton>
              </div>
            </div>

            <p className="text-ink-secondary mb-4 text-sm leading-6">
              下面是这次重塑的 6 个新命格。先选满 3 个，再确认替换当前命格。
            </p>

            {isBooting ? (
              <InkNotice>正在恢复重塑状态……</InkNotice>
            ) : candidateFates.length === 0 ? (
              <InkNotice tone="warning">当前没有可用的命格。</InkNotice>
            ) : (
              <InkList>
                {candidateFates.map((fate, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  const fateDisplay = toFateDisplayModel(fate);

                  return (
                    <div
                      key={`${fate.name}-${idx}`}
                      className={`ink-selectable ${
                        isSelected ? 'ink-selectable-active' : ''
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left"
                        onClick={() => toggleSelection(idx)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSelection(idx);
                          }
                        }}
                      >
                        <ItemCard
                          name={fate.name}
                          quality={fate.quality}
                          meta={
                            <FateEffectInlineList
                              lines={fateDisplay.previewLines}
                            />
                          }
                          description={fate.description}
                          actions={
                            <div
                              className="flex gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <InkButton
                                variant="secondary"
                                onClick={() => setDetailFate(fate)}
                              >
                                详情
                              </InkButton>
                              {isSelected ? (
                                <InkTag tone="good">已选</InkTag>
                              ) : null}
                            </div>
                          }
                          layout="col"
                        />
                      </div>
                    </div>
                  );
                })}
              </InkList>
            )}
          </InkSection>

          <InkActionGroup align="center">
            <InkButton
              variant="primary"
              onClick={handleConfirm}
              disabled={pendingAction !== null || selectedIndices.length !== 3}
            >
              {pendingAction === 'confirm' ? '替换中…' : '确认全量替换 3 个命格'}
            </InkButton>
          </InkActionGroup>
        </>
      )}

      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
    </InkPageShell>
  );
}
