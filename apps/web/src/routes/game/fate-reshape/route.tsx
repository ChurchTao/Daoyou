import { apiFetch } from '@app/lib/api/fetch';
import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkButton,
  InkCard,
  InkList,
  InkNotice,
  InkTag,
  ItemCard,
} from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import type { PreHeavenFate } from '@daoyou/game-domain/character';
import type { FateReshapeSessionDTO } from '@daoyou/game-domain/fate-reshape';
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
  data?: {
    selectedFates: PreHeavenFate[];
  };
  error?: string;
};

function formatExpireTime(expiresAt: number): string {
  return new Date(expiresAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FateReshapePage() {
  const profile = useCultivatorIdentity();
  const playerSession = usePlayerSession();
  const cultivator = profile.data?.cultivator;
  const note = playerSession.data?.note;
  const isLoading = profile.loading || playerSession.loading;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [session, setSession] = useState<FateReshapeSessionDTO | null>(null);
  const [talismanCount, setTalismanCount] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [detailFate, setDetailFate] = useState<PreHeavenFate | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'start' | 'reroll' | 'confirm' | 'abandon' | null
  >(null);
  const [isBooting, setIsBooting] = useState(true);

  const loadSession = useCallback(
    async (showErrorToast = true) => {
      if (!cultivator) {
        setIsBooting(false);
        return;
      }

      setIsBooting(true);
      try {
        const response = await apiFetch('/api/fate-reshape/session');
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
    },
    [cultivator, pushToast],
  );

  useEffect(() => {
    if (!cultivator) {
      return;
    }

    let cancelled = false;

    const bootSession = async () => {
      try {
        const response = await apiFetch('/api/fate-reshape/session');
        const result = (await response.json()) as SessionResponse;

        if (cancelled) return;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '获取命格重塑状态失败');
        }

        setSession(result.data.session);
        setTalismanCount(result.data.talismanCount);
      } catch (error) {
        if (cancelled) return;
        console.error('获取命格重塑状态失败:', error);
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };

    void bootSession();

    return () => {
      cancelled = true;
    };
  }, [cultivator]);

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
      const result = await mutate<NonNullable<SessionMutationResponse['data']>>(
        apiFetch('/api/fate-reshape/session', {
          method: 'POST',
        }),
      );

      if (!result.session) {
        throw new Error('开启命格重塑失败');
      }

      setSession(result.session);
      setTalismanCount(result.talismanCount ?? talismanCount);
      setSelectedIndices([]);
      pushToast({
        message: '命格重塑已开启。',
        tone: 'success',
      });
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
      const response = await apiFetch('/api/fate-reshape/reroll', {
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
      await mutate<NonNullable<ConfirmResponse['data']>>(
        apiFetch('/api/fate-reshape/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedIndices }),
        }),
      );

      setSession(null);
      setSelectedIndices([]);
      await loadSession(false);
      pushToast({
        message: '已用选中的 3 个命格替换原命格。',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '确认命格重塑失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleAbandon = async () => {
    setPendingAction('abandon');
    try {
      const response = await apiFetch('/api/fate-reshape/abandon', {
        method: 'POST',
      });
      const result = (await response.json()) as ConfirmResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '放弃命格重塑失败');
      }

      setSession(null);
      setSelectedIndices([]);
      pushToast({
        message: '已放弃本次重塑，原命格保持不变。',
        tone: 'success',
      });
      await loadSession(false);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '放弃命格重塑失败',
        tone: 'danger',
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="命格天机推演中……" />;
  }

  if (!cultivator) {
    return (
      <GameSceneFrame
        variant="lite"
        title="【命格重塑】"
        description="需先踏入仙途，方能拨动天机。"
      >
        <InkNotice>当前没有活跃角色，暂无法进行命格重塑。</InkNotice>
      </GameSceneFrame>
    );
  }

  return (
    <GameSceneFrame
      variant="workflow"
      title="【命格重塑】"
      description="用天机逆命符重抽命格，再从候选中选出 3 个替换当前命格。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        !session ? (
          <>
            <GameSceneAsideSection title="重塑资源">
              <div className="space-y-2 text-sm leading-7">
                <p>天机逆命符：{talismanCount} 张</p>
                <p>重塑状态：未开启</p>
              </div>
            </GameSceneAsideSection>
            <GameSceneAsideSection
              title="操作规则"
              className="text-sm leading-7"
              help={{
                title: '命格重塑操作规则',
                content: (
                  <div className="space-y-2 text-sm leading-7">
                    <p>开启后消耗 1 张天机逆命符，并给出 8 个候选命格。</p>
                    <p>从中选 3 个，替换当前的 3 个命格。</p>
                  </div>
                ),
              }}
            />
          </>
        ) : (
          <>
            <GameSceneAsideSection title="本次重塑">
              <div className="space-y-2 text-sm leading-7">
                <p>已选候选：{selectedIndices.length} / 3</p>
                <p>剩余重抽：{session.canReroll ? '1 次' : '0 次'}</p>
                <p>失效时间：{formatExpireTime(session.expiresAt)}</p>
              </div>
            </GameSceneAsideSection>
            <GameSceneAsideSection
              title="确认条件"
              className="text-sm leading-7"
              help={{
                title: '命格重塑确认条件',
                content: (
                  <div className="space-y-2 text-sm leading-7">
                    <p>选满 3 个命格后，才能确认替换。</p>
                    <p>放弃或超时会结束本次重塑，符箓不返还。</p>
                  </div>
                ),
              }}
            />
          </>
        )
      }
    >
      <GameSceneSection title="当前命格">
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
                  meta={
                    <FateEffectInlineList lines={fateDisplay.previewLines} />
                  }
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
      </GameSceneSection>

      {isBooting && !session ? (
        <GameSceneSection title="开始重塑">
          <InkNotice>正在恢复上次的命格重塑……</InkNotice>
        </GameSceneSection>
      ) : !session ? (
        <GameSceneSection title="开始重塑">
          <InkCard variant="elevated" padding="lg" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-ink/10 border border-dashed px-3 py-2">
                <div className="text-ink-secondary text-xs">天机逆命符</div>
                <div className="text-ink text-lg font-semibold">
                  {talismanCount} 张
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm leading-6">
              <p>开启时消耗 1 张天机逆命符，获得 8 个候选命格。</p>
              <p>选出 3 个替换当前命格。中途放弃，符箓不返还。</p>
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
                disabled={
                  (pendingAction !== null && pendingAction !== 'start') ||
                  talismanCount <= 0
                }
                pending={pendingAction === 'start'}
                pendingLabel="启封中……"
              >
                消耗 1 张天机逆命符，开启重塑
              </InkButton>
            </InkActionGroup>
          </InkCard>
        </GameSceneSection>
      ) : (
        <>
          <GameSceneSection title="当前进度">
            <InkCard variant="elevated" padding="lg" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border-ink/10 border border-dashed px-3 py-2">
                  <div className="text-ink-secondary text-xs">剩余重抽</div>
                  <div className="text-ink text-lg font-semibold">
                    {session.canReroll ? '1 次' : '0 次'}
                  </div>
                </div>
                <div className="border-ink/10 border border-dashed px-3 py-2">
                  <div className="text-ink-secondary text-xs">
                    天机将于此失效
                  </div>
                  <div className="text-ink text-lg font-semibold">
                    {formatExpireTime(session.expiresAt)}
                  </div>
                </div>
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                离开后仍可继续，直到确认、放弃或本次重塑过期。
              </p>
            </InkCard>
          </GameSceneSection>

          <GameSceneSection title="命格候选">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-ink-secondary text-sm">{`已选 ${selectedIndices.length}/3`}</span>
              <div className="flex flex-wrap items-center gap-2">
                <InkButton
                  variant="secondary"
                  onClick={handleReroll}
                  disabled={
                    (pendingAction !== null && pendingAction !== 'reroll') ||
                    !session.canReroll
                  }
                  pending={pendingAction === 'reroll'}
                  pendingLabel="重塑中……"
                >
                  重抽候选
                </InkButton>
                <InkButton
                  variant="secondary"
                  onClick={handleAbandon}
                  disabled={
                    pendingAction !== null && pendingAction !== 'abandon'
                  }
                  pending={pendingAction === 'abandon'}
                  pendingLabel="放弃中……"
                >
                  放弃重塑
                </InkButton>
              </div>
            </div>

            <p className="text-ink-secondary mb-4 text-sm leading-6">
              选出 3 个命格，确认后替换当前命格。
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
          </GameSceneSection>

          <InkActionGroup align="center">
            <InkButton
              variant="primary"
              onClick={handleConfirm}
              disabled={
                (pendingAction !== null && pendingAction !== 'confirm') ||
                selectedIndices.length !== 3
              }
              pending={pendingAction === 'confirm'}
              pendingLabel="替换中……"
            >
              确认替换 3 个命格
            </InkButton>
          </InkActionGroup>
        </>
      )}

      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
    </GameSceneFrame>
  );
}
