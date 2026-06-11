import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
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
  const { cultivator, display, isLoading } = usePlayerStateView();
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
        <p className="loading-tip">灵眼之泉雾气未散……</p>
      </div>
    );
  }

  if (!cultivator || !state) {
    return (
      <GameSceneFrame
        variant="lite"
        title="灵眼之泉"
        description="需先踏入仙途，方能引泉中灵息温养道体。"
      >
        <InkNotice>当前没有活跃角色，暂时无法借灵泉疗伤。</InkNotice>
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
          ? `你在灵眼之泉中静养片刻，气息已稳。修为折损 ${result.cultivationLossAmount} 点。`
          : '你在灵眼之泉中静养片刻，气息已稳。';

      pushToast({
        message: recoveryMessage,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '灵泉疗伤失败',
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
      title: '要引泉疗伤吗？',
      content: (
        <div className="space-y-2 text-sm leading-7">
          <p>
            洞府法阵会消耗 {state.spiritStoneCost}{' '}
            灵石，引灵眼泉息入体。
          </p>
          <p>泉息周转之后，你的气血与法力都会恢复，身上所有状态也会一并散去。</p>
          {cultivationLossHint ? <p>{cultivationLossHint}</p> : null}
          <p>丹毒不会被灵泉化开，若有余毒，仍需另寻办法。</p>
        </div>
      ),
      confirmLabel: `付 ${state.spiritStoneCost} 灵石引泉`,
      cancelLabel: '再想想',
      onConfirm: handleRecovery,
    });
  };

  return (
    <GameSceneFrame
      variant="lite"
      title="灵眼之泉"
      description="洞府深处泉眼含灵，泉雾沿石脉缓缓流转。若以灵石催动阵纹，便可借泉息温养伤势、稳住乱掉的气机。"
    >
      <GameSceneSection>
        <InkCard variant="elevated" padding="lg" className="space-y-5">
          <div className="text-ink space-y-3 text-sm leading-7">
            <p>
              石室内泉声极轻，灵雾贴着池沿升起，落在经脉间有细微凉意。你只需将灵石嵌入阵槽，泉眼便会牵引洞府灵气回护周身。
            </p>
            <p>
              借泉息静养后，气血与法力会一并回满，缠身的杂乱状态也会散去。只是丹毒沉在药性深处，灵眼之泉暂时化不开。
            </p>
          </div>

          {!needsRecovery ? (
            <InkNotice tone="warning">
              你此刻气息尚稳。若只是想散去丹毒，灵眼之泉暂时帮不上忙。
            </InkNotice>
          ) : null}

          {needsRecovery && !hasEnoughSpiritStones ? (
            <InkNotice tone="warning">
              阵槽灵光一闪即灭。你手头的灵石还不够催动这眼灵泉。
            </InkNotice>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <InkButton
              variant="primary"
              onClick={openRecoveryConfirm}
              disabled={!canConfirmRecovery}
            >
              {isSubmitting ? '调息中...' : '引泉疗伤'}
            </InkButton>
            <span className="text-ink-secondary text-sm">
              若要静养伤势，向阵槽投入灵石即可。
            </span>
          </div>
        </InkCard>
      </GameSceneSection>
    </GameSceneFrame>
  );
}
