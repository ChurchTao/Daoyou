import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  BlackMarketInspectionKind,
  BlackMarketNegotiationMood,
  BlackMarketNpcId,
  BlackMarketOverview,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BlackMarketConversation } from './BlackMarketConversation';
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

const NEGOTIATION_MOOD_LABEL: Record<BlackMarketNegotiationMood, string> = {
  calm: '神色从容',
  guarded: '开始掂量',
  impatient: '已有不耐',
  agreed: '已经认价',
  closed: '咬死价格',
};

function formatCountdown(target: number): string {
  const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours > 0 ? `${hours}时` : ''}${minutes}分${rest}秒`;
}

export default function BlackMarketPage() {
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get('nodeId') || DEFAULT_NODE_ID;
  const currency = useCultivatorCurrency();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [overview, setOverview] = useState<BlackMarketOverview>();
  const [session, setSession] = useState<BlackMarketSessionView>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [timeLeft, setTimeLeft] = useState('');

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
          setTimeLeft(formatCountdown(next.nextRefresh));
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
    const timer = window.setInterval(
      () => setTimeLeft(formatCountdown(overview.nextRefresh)),
      1000,
    );
    const rolloverTimer = window.setTimeout(
      () => {
        void (async () => {
          try {
            const nextOverview = await loadOverview();
            if (cancelled) return;
            setSession(undefined);
            setOverview(nextOverview);
            setTimeLeft(formatCountdown(nextOverview.nextRefresh));
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
      Math.max(250, overview.nextRefresh - Date.now() + 250),
    );
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(rolloverTimer);
    };
  }, [loadOverview, overview, pushToast]);

  const selectedNpc = useMemo(
    () => overview?.npcs.find((npc) => npc.id === session?.npcId),
    [overview, session?.npcId],
  );

  const runInteraction = async (
    input:
      | { action: 'inspect'; inspectionKind: BlackMarketInspectionKind }
      | { action: 'question'; message: string }
      | { action: 'haggle'; message?: string; offeredPrice: number },
  ) => {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await interactWithBlackMarket(nodeId, session.id, {
        ...input,
        version: session.version,
      });
      setSession(result.session);
      if (result.notice) {
        setNotice(result.notice);
      } else if (input.action === 'haggle') {
        const feedback =
          result.outcome === 'accepted'
            ? `摊主点头认价：${result.session.currentPrice.toLocaleString()} 灵石。`
            : result.outcome === 'conceded' || result.outcome === 'countered'
              ? `摊主松了口：现在要价 ${result.session.currentPrice.toLocaleString()} 灵石。`
              : result.outcome === 'locked'
                ? '这一下压得太狠，摊主把价彻底咬死了。'
                : result.outcome === 'rejected'
                  ? '摊主没有松口。'
                  : undefined;
        if (feedback) setNotice(feedback);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '交谈暂时中断');
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (npcId: BlackMarketNpcId) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      setSession(await openBlackMarketSession(nodeId, npcId));
    } catch (reason) {
      pushToast({
        message: reason instanceof Error ? reason.message : '摊主没有理会你',
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
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
        setTimeLeft(formatCountdown(nextOverview.nextRefresh));
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
      const nextOverview = await loadOverview();
      setOverview(nextOverview);
      setTimeLeft(formatCountdown(nextOverview.nextRefresh));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '离开失败');
    } finally {
      setBusy(false);
    }
  };

  const detail = session?.reveal ? (
    <BlackMarketRevealPanel
      reveal={session.reveal}
      onBack={() => setSession(undefined)}
    />
  ) : session && selectedNpc ? (
    <BlackMarketConversation
      npc={selectedNpc}
      session={session}
      busy={busy}
      error={error}
      notice={notice}
      onInspect={(inspectionKind) =>
        void runInteraction({ action: 'inspect', inspectionKind })
      }
      onQuestion={(message) =>
        void runInteraction({ action: 'question', message })
      }
      onHaggle={(message, offeredPrice) =>
        void runInteraction({ action: 'haggle', message, offeredPrice })
      }
      onCommit={handleCommit}
      onLeave={() => void handleLeave()}
    />
  ) : undefined;

  return (
    <GameSceneFrame
      title="【暗巷黑市】"
      description="灯火之外，来历不明的货只在低声交谈中显出几分真相。"
      aside={
        <>
          <GameSceneAsideSection title="暗巷余时">
            <div className="space-y-2 text-sm leading-7">
              <p>本轮收摊：{timeLeft || '读取中'}</p>
              <p>灵石余额：{currency.data?.spiritStones ?? '读取中'}</p>
            </div>
          </GameSceneAsideSection>
          {session ? (
            <GameSceneAsideSection title="手中线索">
              <div className="space-y-2 text-sm leading-7">
                <p>已知线索：{session.revealedClues.length} 条</p>
                <p>
                  摊主态度：{NEGOTIATION_MOOD_LABEL[session.negotiationMood]}
                </p>
                <p>当前报价：{session.currentPrice.toLocaleString()} 灵石</p>
              </div>
            </GameSceneAsideSection>
          ) : null}
        </>
      }
    >
      {loading ? (
        <GameLoadingState message="正在寻找暗巷入口……" variant="inline" />
      ) : overview ? (
        <BlackMarketRoom
          overview={overview}
          selectedNpcId={session?.npcId}
          busy={busy}
          detail={detail}
          onSelect={(npcId) => void handleSelect(npcId)}
        />
      ) : (
        <InkNotice>{error || '黑市暂未开门。'}</InkNotice>
      )}
    </GameSceneFrame>
  );
}
