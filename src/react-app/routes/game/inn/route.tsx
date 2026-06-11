import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import {
  calculateInnRecoverySpiritStoneCost,
  calculateInnRecoveryLossRange,
} from '@shared/config/innRecovery';
import { isConditionStatusActive } from '@shared/lib/condition';
import { evaluateFateContext, getInnSpiritStoneMultiplier } from '@shared/lib/fates';
import { useState } from 'react';

type InnRecoveryResponse = {
  success: boolean;
  data?: {
    spiritStoneCost: number;
    cultivationLossPercent: number;
    cultivationLossAmount: number;
    clearedStatusCount: number;
  };
  error?: string;
};

export default function InnRecoveryPage() {
  const { cultivator, display, isLoading } = useCultivator();
  const { mutate } = usePlayerStateActions();
  const { openDialog, pushToast } = useInkUI();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = cultivator
    ? (() => {
        const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
        const spiritStoneCost = calculateInnRecoverySpiritStoneCost(
          cultivator.realm,
          getInnSpiritStoneMultiplier(fateContext),
        );

        const hp = display?.resources.hp;
        const mp = display?.resources.mp;
        const maxHp = Math.max(1, Math.floor(hp?.max ?? 1));
        const maxMp = Math.max(1, Math.floor(mp?.max ?? 1));
        const currentHp = Math.max(0, Math.floor(hp?.current ?? maxHp));
        const currentMp = Math.max(0, Math.floor(mp?.current ?? maxMp));
        const activeStatusCount = (cultivator.condition?.statuses ?? []).filter(
          (status) => isConditionStatusActive(status),
        ).length;
        const cultivationLossRange = calculateInnRecoveryLossRange(
          cultivator.cultivation_progress?.cultivation_exp ?? 0,
          fateContext.innCultivationLossMultiplier,
        );

        return {
          spiritStoneCost,
          maxHp,
          maxMp,
          currentHp,
          currentMp,
          activeStatusCount,
          cultivationLossRange,
        };
      })()
    : null;

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">客栈正在整理上房……</p>
      </div>
    );
  }

  if (!cultivator || !state) {
    return (
      <GameSceneFrame
        variant="lite"
        title="住店疗伤"
        description="需先踏入仙途，方能在客栈安顿疗伤。"
      >
        <InkNotice>当前没有活跃角色，暂时无法住店疗伤。</InkNotice>
      </GameSceneFrame>
    );
  }

  const needsRecovery =
    state.currentHp < state.maxHp ||
    state.currentMp < state.maxMp ||
    state.activeStatusCount > 0;
  const hasEnoughSpiritStones =
    cultivator.spirit_stones >= state.spiritStoneCost;
  const canConfirmRecovery =
    needsRecovery && hasEnoughSpiritStones && !isSubmitting;

  const handleRecovery = async () => {
    setIsSubmitting(true);
    try {
      const result = await mutate<NonNullable<InnRecoveryResponse['data']>>(
        fetch('/api/cultivator/inn-recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      const recoveryMessage =
        result.cultivationLossAmount > 0
          ? `你在客栈歇过一夜，气息已稳。修为折损 ${result.cultivationLossAmount} 点。`
          : '你在客栈歇过一夜，气息已稳。';

      pushToast({
        message: recoveryMessage,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '住店疗伤失败',
        tone: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRecoveryConfirm = () => {
    if (!canConfirmRecovery) return;

    const cultivationLossHint =
      state.cultivationLossRange.max > 0
        ? state.cultivationLossRange.min === state.cultivationLossRange.max
          ? `代价是折去你当前修为 ${state.cultivationLossRange.max} 点。`
          : `代价是折去你当前修为 ${state.cultivationLossRange.min}-${state.cultivationLossRange.max} 点。`
        : null;

    openDialog({
      title: '要住这一晚吗？',
      content: (
        <div className="space-y-2 text-sm leading-7">
          <p>
            掌柜会收下 {state.spiritStoneCost}{' '}
            灵石，替你备好静房与药汤。
          </p>
          <p>这一夜过去，你的气血与法力都会恢复，身上所有状态也会一并散去。</p>
          {cultivationLossHint ? <p>{cultivationLossHint}</p> : null}
          <p>丹毒不会在这间客栈里化开，若有余毒，仍需另寻办法。</p>
        </div>
      ),
      confirmLabel: `付 ${state.spiritStoneCost} 灵石住店`,
      cancelLabel: '再想想',
      onConfirm: handleRecovery,
    });
  };

  return (
    <GameSceneFrame
      variant="lite"
      title="住店疗伤"
      description="门帘半掩，灯火暖黄。楼上备着热汤与静房，若你想歇上一夜，掌柜自会替你稳住乱掉的气息。"
    >
      <GameSceneSection>
        <InkCard variant="elevated" padding="lg" className="space-y-5">
          <div className="text-ink space-y-3 text-sm leading-7">
            <p>
              你推门入内，药香混着热水白气从后院慢慢漫出来。掌柜只抬眼看了你一瞬，便把楼上的静房与药汤一并备下，仿佛这样的伤客他已见过太多。
            </p>
            <p>
              若在这里歇上一夜，乱掉的气息能缓回来，连缠在身上的杂乱状态也会一并散去。只是丹毒太深的东西，这家客栈也化不开。
            </p>
          </div>

          {!needsRecovery ? (
            <InkNotice tone="warning">
              你此刻气息尚稳。若只是想散去丹毒，这间客栈帮不上忙。
            </InkNotice>
          ) : null}

          {needsRecovery && !hasEnoughSpiritStones ? (
            <InkNotice tone="warning">
              掌柜拨了拨算盘，摇头不语。你手头的灵石还不够住这一晚。
            </InkNotice>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <InkButton
              variant="primary"
              onClick={openRecoveryConfirm}
              disabled={!canConfirmRecovery}
            >
              {isSubmitting ? '调息中...' : '上楼住店'}
            </InkButton>
            <span className="text-ink-secondary text-sm">
              若要歇脚养伤，与掌柜知会一声便可。
            </span>
          </div>
        </InkCard>
      </GameSceneSection>
    </GameSceneFrame>
  );
}
