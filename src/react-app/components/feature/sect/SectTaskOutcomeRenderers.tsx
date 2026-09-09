import { InkButton, InkDialog, InkNotice } from '@app/components/ui';
import type { SectOutcomeRendererProps } from '@app/lib/sect/presentation/core/registry';
import type {
  SectTaskRewardReceipt,
} from '@shared/contracts/sect';
import { createSectRoomNpcHref } from './sectRoomNavigation';
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
        onClick={() =>
          interaction.navigate(
            createSectRoomNpcHref('/game/sect/gate', 'facility'),
          )
        }
      >
        前往山门
      </InkButton>
    </InkNotice>
  );
}

export function MiningSessionOutcome({
  task,
}: SectOutcomeRendererProps<unknown>) {
  const interaction = useSectTaskInteraction();
  return (
    <InkNotice className="mt-4">
      「{task.presentation.title}」采掘场已在灵脉开启。
      <InkButton
        variant="secondary"
        onClick={() =>
          interaction.navigate(
            createSectRoomNpcHref('/game/sect/spirit-vein', 'facility'),
          )
        }
      >
        前往灵脉
      </InkButton>
    </InkNotice>
  );
}

export function MiningResultOutcome({
  task,
  data,
}: SectOutcomeRendererProps<unknown>) {
  const result = data as {
    score: number;
    maxScore: number;
    tier?: string;
    qualified: boolean;
  };
  return (
    <InkNotice className="mt-4">
      「{task.presentation.title}」得分 {result.score}/{result.maxScore}
      {result.qualified ? `，评定为 ${result.tier} 档。` : '，尚未达到验收线。'}
    </InkNotice>
  );
}

export function CompletedOutcome({ task }: SectOutcomeRendererProps<unknown>) {
  const { clearOutcome } = useSectTaskInteraction();
  return (
    <InkDialog
      dialog={{
        id: `sect-task-${task.id}`,
        title: task.state === 'claimable' ? '委托回执已成' : '告示已经揭下',
        content: (
          <p className="text-sm leading-7">
            {task.state === 'claimable'
              ? '任务已经达成，赏赐尚未发放。请在告示榜领取结算。'
              : '委托已经登记，可按告示要求开始执行。'}
          </p>
        ),
        confirmLabel: '知道了',
        cancelLabel: null,
      }}
      onClose={clearOutcome}
    />
  );
}

export function RewardClaimedOutcome({
  task,
  data,
}: SectOutcomeRendererProps<unknown>) {
  const { clearOutcome } = useSectTaskInteraction();
  const receipt = data as SectTaskRewardReceipt;
  return (
    <InkDialog
      dialog={{
        id: `sect-task-reward-${receipt.taskRecordId}`,
        title: '委托已结清',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p className="font-semibold">{task.presentation.title}</p>
            {receipt.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="pt-2 text-stone-500">以上奖励已经入账</p>
          </div>
        ),
        confirmLabel: '收下赏赐',
        cancelLabel: null,
      }}
      onClose={clearOutcome}
    />
  );
}
