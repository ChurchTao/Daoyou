import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkDialog,
  InkNotice,
  type InkDialogState,
} from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  BlackMarketNpcId,
  BlackMarketOpenResult,
  BlackMarketOverview,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BlackMarketConversation } from './BlackMarketConversation';
import { BlackMarketEntryPreview } from './BlackMarketEntryPreview';
import { BlackMarketRevealPanel } from './BlackMarketReveal';
import { BlackMarketRoom } from './BlackMarketRoom';
import {
  commitBlackMarketPurchase,
  fetchBlackMarketOverview,
  interactWithBlackMarket,
  leaveBlackMarketSession,
  openBlackMarketSession,
} from './blackMarketApi';

const DEFAULT_NODE_ID = 'TN_YUE_01';

export default function BlackMarketPage() {
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get('nodeId') || DEFAULT_NODE_ID;
  const currency = useCultivatorCurrency();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [overview, setOverview] = useState<BlackMarketOverview>();
  const [session, setSession] = useState<BlackMarketSessionView>();
  const [selectedNpcId, setSelectedNpcId] = useState<BlackMarketNpcId>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [retryableMessage, setRetryableMessage] = useState<string>();
  const [openingStep, setOpeningStep] = useState<number>();
  const [entryDialog, setEntryDialog] = useState<InkDialogState | null>(null);
  const interactionControllerRef = useRef<AbortController | undefined>(
    undefined,
  );

  useEffect(() => () => interactionControllerRef.current?.abort(), []);

  const loadOverview = useCallback(
    (signal?: AbortSignal) => fetchBlackMarketOverview(nodeId, signal),
    [nodeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await loadOverview(controller.signal);
        if (!controller.signal.aborted) {
          setOverview(next);
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : '黑市暂未开门');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [loadOverview]);

  useEffect(() => {
    if (!overview) return;
    let cancelled = false;
    const rolloverTimer = window.setTimeout(
      () => {
        void (async () => {
          try {
            const nextOverview = await loadOverview();
            if (cancelled) return;
            setSession(undefined);
            setSelectedNpcId(undefined);
            setOverview(nextOverview);
            setError(undefined);
            setNotice(undefined);
          } catch (reason) {
            if (cancelled) return;
            pushToast({
              message:
                reason instanceof Error ? reason.message : '新一轮黑市暂未开门',
              tone: 'warning',
            });
          }
        })();
      },
      Math.max(250, overview.resetsAt - Date.now() + 250),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(rolloverTimer);
    };
  }, [loadOverview, overview, pushToast]);

  const selectedNpc = useMemo(
    () => overview?.npcs.find((npc) => npc.id === selectedNpcId),
    [overview, selectedNpcId],
  );

  const runInteraction = async (message?: string, offeredPrice?: number) => {
    if (!session) return;
    const activeSession = session;
    const controller = new AbortController();
    interactionControllerRef.current?.abort();
    interactionControllerRef.current = controller;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const optimisticId = `${activeSession.id}:${activeSession.version}:optimistic`;
    const optimisticBody = message?.trim()
      ? offeredPrice != null
        ? `${message.trim()}（报价：${offeredPrice.toLocaleString()}灵石）`
        : message.trim()
      : `我出${offeredPrice?.toLocaleString()}灵石。`;
    setSession((current) =>
      current
        ? {
            ...current,
            messages: [
              ...current.messages,
              {
                id: `${optimisticId}:player`,
                role: 'player',
                body: optimisticBody,
                createdAt: Date.now(),
                turn: activeSession.version,
              },
              {
                id: `${optimisticId}:npc`,
                role: 'npc',
                body: '……',
                gesture:
                  offeredPrice != null
                    ? '他没有立刻接价，只用指节轻敲摊沿。'
                    : '他重新打量着你指出的地方。',
                createdAt: Date.now() + 1,
                turn: activeSession.version,
              },
            ],
          }
        : current,
    );
    try {
      const result = await interactWithBlackMarket(
        nodeId,
        activeSession.id,
        { message, offeredPrice, version: activeSession.version },
        {
          onResolved: (event) => {
            setSession({
              ...event.result.session,
              messages: event.result.session.messages.map((item) =>
                item.id === event.messageId ? { ...item, body: '' } : item,
              ),
            });
          },
          onReplyChunk: (messageId, text) => {
            setSession((current) =>
              current
                ? {
                    ...current,
                    messages: current.messages.map((item) =>
                      item.id === messageId
                        ? { ...item, body: `${item.body}${text}` }
                        : item,
                    ),
                  }
                : current,
            );
          },
          onReplyComplete: (messageId, body) => {
            setSession((current) =>
              current
                ? {
                    ...current,
                    messages: current.messages.map((item) =>
                      item.id === messageId ? { ...item, body } : item,
                    ),
                  }
                : current,
            );
          },
          onReplyError: (messageId, fallbackBody) => {
            setSession((current) =>
              current
                ? {
                    ...current,
                    messages: current.messages.map((item) =>
                      item.id === messageId
                        ? { ...item, body: fallbackBody }
                        : item,
                    ),
                  }
                : current,
            );
          },
        },
        controller.signal,
      );
      if (result.notice) {
        setNotice(result.notice);
      } else if (offeredPrice != null) {
        const feedback =
          result.outcome === 'accepted'
            ? `摊主点头认价：${result.session.currentPrice.toLocaleString()} 灵石。`
            : result.outcome === 'countered'
              ? `摊主松了口：现在要价 ${result.session.currentPrice.toLocaleString()} 灵石。`
              : result.outcome === 'locked'
                ? '这一下压得太狠，摊主把价彻底咬死了。'
                : result.outcome === 'rejected'
                  ? '摊主没有松口。'
                  : undefined;
        if (feedback) setNotice(feedback);
      }
      if (result.session.phase === 'abandoned') {
        setSession(undefined);
        setSelectedNpcId(undefined);
        const nextOverview = await loadOverview();
        setOverview(nextOverview);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setSession(activeSession);
        setError(reason instanceof Error ? reason.message : '交谈暂时中断');
      }
    } finally {
      if (interactionControllerRef.current === controller) {
        interactionControllerRef.current = undefined;
        setBusy(false);
      }
    }
  };

  const startOpening = async (npcId: BlackMarketNpcId) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setRetryableMessage(undefined);
    setOpeningStep(0);
    const transitionTimer = window.setInterval(
      () => setOpeningStep((current) => Math.min(2, (current ?? 0) + 1)),
      2_400,
    );
    try {
      const result = await mutate<BlackMarketOpenResult>(
        openBlackMarketSession(nodeId, npcId),
      );
      if (result.status === 'ready') {
        setSession(result.session);
      } else {
        setSession(undefined);
        setRetryableMessage(result.message);
      }
      setOverview(await loadOverview());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '摊主没有理会你');
    } finally {
      window.clearInterval(transitionTimer);
      setOpeningStep(undefined);
      setBusy(false);
    }
  };

  const handleSelect = (npcId: BlackMarketNpcId) => {
    setSelectedNpcId(npcId);
    setSession(undefined);
    setError(undefined);
    setNotice(undefined);
    setRetryableMessage(undefined);
  };

  const handleEnter = () => {
    if (!overview || !selectedNpc) return;
    const needsPayment =
      selectedNpc.status === 'available' &&
      overview.entryPolicy.nextEntryCost === 5;
    if (!needsPayment) {
      void startOpening(selectedNpc.id);
      return;
    }
    setEntryDialog({
      id: `black-market-entry:${overview.dayKey}:${selectedNpc.id}`,
      title: '确认走近摊位',
      content: (
        <div className="space-y-2 text-sm leading-7">
          <p>
            今日的免费机会已用，此次入场需消耗
            <span className="text-teal mx-1">5点天地灵气</span>。
          </p>
          <p className="text-ink-secondary">
            当前灵气：{currency.data?.qi ?? '读取中'}
          </p>
        </div>
      ),
      confirmLabel: '支付并入场',
      cancelLabel: '再想想',
      onConfirm: () => {
        void startOpening(selectedNpc.id);
      },
    });
  };

  const handleCommit = async () => {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await mutate<{
        reveal: NonNullable<BlackMarketSessionView['reveal']>;
      }>(
        commitBlackMarketPurchase(
          nodeId,
          session.id,
          session.version,
          session.currentPrice,
        ),
      );
      setSession((current) =>
        current
          ? {
              ...current,
              phase: 'completed',
              reveal: result.reveal,
              currentPrice: result.reveal.paidPrice,
              version: current.version + 1,
            }
          : current,
      );
      try {
        const nextOverview = await loadOverview();
        setOverview(nextOverview);
      } catch {
        pushToast({
          message: '交易已经完成，但摊位状态暂未刷新',
          tone: 'warning',
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成交失败');
      throw reason;
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await leaveBlackMarketSession(nodeId, session.id, session.version);
      setSession(undefined);
      setSelectedNpcId(undefined);
      const nextOverview = await loadOverview();
      setOverview(nextOverview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '离开失败');
    } finally {
      setBusy(false);
    }
  };

  const detail = session?.reveal ? (
    <BlackMarketRevealPanel
      reveal={session.reveal}
      onBack={() => {
        setSession(undefined);
        setSelectedNpcId(undefined);
      }}
    />
  ) : session && selectedNpc ? (
    <BlackMarketConversation
      npc={selectedNpc}
      session={session}
      busy={busy}
      error={error}
      notice={notice}
      onSubmit={(message, offeredPrice) =>
        void runInteraction(message, offeredPrice)
      }
      onCommit={handleCommit}
      onLeave={() => void handleLeave()}
    />
  ) : selectedNpc && overview ? (
    <BlackMarketEntryPreview
      npc={selectedNpc}
      entryCost={
        selectedNpc.status === 'available'
          ? overview.entryPolicy.nextEntryCost
          : 0
      }
      currentQi={currency.data?.qi}
      busy={busy}
      openingStep={openingStep}
      error={error}
      retryableMessage={retryableMessage}
      onEnter={handleEnter}
      onBack={() => {
        setSelectedNpcId(undefined);
        setError(undefined);
        setRetryableMessage(undefined);
      }}
    />
  ) : undefined;

  return (
    <>
      <GameSceneFrame
        title="【暗巷黑市】"
        description="灯火之外，来历不明的货只在低声交谈中显出几分真相。"
        aside={
          <GameSceneAsideSection title="随身资用">
            <p className="text-sm leading-7">
              灵石余额：{currency.data?.spiritStones ?? '读取中'}
            </p>
          </GameSceneAsideSection>
        }
      >
        {loading ? (
          <GameLoadingState message="正在寻找暗巷入口……" variant="inline" />
        ) : overview ? (
          <BlackMarketRoom
            overview={overview}
            selectedNpcId={selectedNpcId}
            busy={busy}
            detail={detail}
            onSelect={handleSelect}
          />
        ) : (
          <InkNotice>{error || '黑市暂未开门。'}</InkNotice>
        )}
      </GameSceneFrame>
      <InkDialog dialog={entryDialog} onClose={() => setEntryDialog(null)} />
    </>
  );
}
