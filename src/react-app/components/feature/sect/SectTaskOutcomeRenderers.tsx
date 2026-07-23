import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { InkButton, InkNotice } from '@app/components/ui';
import type { SectOutcomeRendererProps } from '@app/lib/sect/presentation/core/registry';
import type {
  SectBattleOutcomeData,
} from '@shared/contracts/sect';
import { useNavigate, useSearchParams } from 'react-router';
import { useSectPresentation } from './SectQueryProvider';
import { useSectTaskInteraction } from './SectTaskInteractionProvider';

export function SweepSessionOutcome({
  task,
}: SectOutcomeRendererProps<unknown>) {
  const interaction = useSectTaskInteraction();
  return (
    <InkNotice className="mt-4">
      「{task.presentation.title}」勤务场已在山门开启。
      <InkButton
        variant="secondary"
        onClick={() => interaction.navigate('/game/sect/gate/sweep')}
      >
        前往山门
      </InkButton>
    </InkNotice>
  );
}

export function CompletedOutcome() {
  const { clearOutcome } = useSectTaskInteraction();
  return (
    <InkNotice className="mt-4">
      宗门卷宗已经更新。
      <InkButton variant="secondary" onClick={clearOutcome}>
        收起结果
      </InkButton>
    </InkNotice>
  );
}

export function BattleOutcome({
  task,
  data,
}: SectOutcomeRendererProps<unknown>) {
  const presentation = useSectPresentation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId') ?? 'unknown';
  const battle = data as SectBattleOutcomeData;
  const playback = useBattlePlaybackState(battle.battle);
  const retry = () =>
    navigate(
      `/game/sect/tasks/${encodeURIComponent(task.definitionId)}/battle?attemptId=${crypto.randomUUID()}`,
      { replace: true },
    );
  return (
    <BattlePageLayout
      title={battle.challengeTitle}
      subtitle="任务封签已启，胜负与战功皆以此局为准。"
      variant="immersive-battle"
      battleResult={battle.battle}
    >
      <BattlePlaybackPanel
        battleResult={battle.battle}
        playback={playback}
        statusAction={{
          label: presentation.terms.returnToAffairs,
          onClick: () => navigate('/game/sect/affairs'),
        }}
      />
      <CombatResultDialog
        key={`${attemptId}-${battle.battle.turns}`}
        dialogKey={`sect-task-${attemptId}`}
        open={playback.isPlaybackFinished}
        title={battle.won ? '宗门战局得胜' : '宗门战局失利'}
        confirmLabel={presentation.terms.returnToAffairs}
        cancelLabel={battle.won ? '重看战局' : '重新挑战'}
        onConfirm={() => navigate('/game/sect/affairs')}
        onCancel={battle.won ? playback.reset : retry}
        content={
          <p className="leading-8">
            {battle.won
              ? battle.rewardGranted
                ? '胜绩与贡献已经记入宗门卷宗。'
                : '胜绩已经记入宗门卷宗。'
              : '此战未能压过残影，任务仍然保留，可整顿后再次挑战。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
