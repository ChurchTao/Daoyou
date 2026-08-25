import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import type { SectTaskViewData } from '@shared/contracts/sect';
import { useEffect, useState } from 'react';
import { createSectRoomNpcHref } from './sectRoomNavigation';
import {
  createSectTaskBattleHref,
  getSectTaskActivityLocation,
  readSectTaskActivityLocation,
} from './sectTaskActivityLocations';
import { useSectTaskInteraction } from './SectTaskInteractionProvider';
import { SectTaskSubmissionDialog } from './SectTaskSubmissionDialog';

export type SectTaskViewAction = SectTaskViewData['actions'][number];

export interface SectTaskActionRendererProps {
  task: SectTaskViewData;
  action: SectTaskViewAction;
  display?: 'default' | 'conversation';
}

const conversationActionClass =
  'w-full cursor-pointer justify-start border-l-2 border-crimson/45 bg-crimson/6 px-5 py-3 text-left text-base hover:bg-crimson/10 focus-visible:outline-crimson focus-visible:outline-2 focus-visible:outline-offset-[-2px]';

function actionClassName(display: SectTaskActionRendererProps['display']) {
  return display === 'conversation' ? conversationActionClass : undefined;
}

export function AcceptAction({
  task,
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() =>
        void execute(task, action, {}, `已接下「${task.presentation.title}」`)
      }
    >
      {action.enabled
        ? display === 'conversation'
          ? task.presentation.dialogue.offeredReply
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

export function ClaimAction({
  task,
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() =>
        void execute(task, action, {}, `「${task.presentation.title}」已结清`)
      }
    >
      {action.enabled
        ? display === 'conversation'
          ? '请执事结清此事'
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

function readAbandonAvailability(action: SectTaskViewAction): {
  availableAt?: number;
  cooldownBlocked: boolean;
} {
  const rawAvailableAt = action.parameters?.availableAt;
  const parsedAvailableAt =
    typeof rawAvailableAt === 'string' ? Date.parse(rawAvailableAt) : NaN;
  return {
    ...(Number.isFinite(parsedAvailableAt)
      ? { availableAt: parsedAvailableAt }
      : {}),
    cooldownBlocked: action.parameters?.cooldownBlocked === true,
  };
}

function formatAbandonCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AbandonAction({
  task,
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  const { openDialog } = useInkUI();
  const availability = readAbandonAvailability(action);
  const [now, setNow] = useState(() => Date.now());
  const remainingMs = availability.availableAt
    ? Math.max(0, availability.availableAt - now)
    : 0;
  const cooldownReady = availability.cooldownBlocked && remainingMs === 0;
  const enabled = action.enabled || cooldownReady;

  useEffect(() => {
    if (!availability.cooldownBlocked || remainingMs === 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(1_000, remainingMs),
    );
    return () => window.clearTimeout(timer);
  }, [availability.cooldownBlocked, remainingMs]);

  const label =
    remainingMs > 0
      ? `领取满 15 分钟后可放弃（${formatAbandonCountdown(remainingMs)}）`
      : display === 'conversation'
        ? '这份委托我不再办了'
        : action.label;

  return (
    <InkButton
      variant="secondary"
      className={actionClassName(display)}
      disabled={busy || !enabled}
      onClick={() =>
        openDialog({
          title: '放弃宗门任务',
          content: (
            <p className="text-ink-secondary text-sm leading-7">
              {`放弃「${task.presentation.title}」后，当前进度与已锁定目标都会作废；你可以立即重新领取，并生成一份新的任务内容。`}
            </p>
          ),
          confirmLabel: '确认放弃',
          cancelLabel: '继续办理',
          loadingLabel: '正在撤下委托……',
          onConfirm: async () => {
            await execute(
              task,
              action,
              {},
              `已放弃「${task.presentation.title}」`,
            );
          },
        })
      }
    >
      {enabled
        ? label
        : remainingMs > 0
          ? label
          : (action.disabledReason ?? '暂不可放弃')}
    </InkButton>
  );
}

export function BattleAction({
  task,
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, navigate } = useSectTaskInteraction();
  const activityLocation = readSectTaskActivityLocation(action);
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() => {
        if (display === 'conversation' && activityLocation) {
          navigate(
            getSectTaskActivityLocation(activityLocation.key, task).route,
          );
          return;
        }
        navigate(
          createSectTaskBattleHref(task.definitionId, activityLocation?.key),
        );
      }}
    >
      {action.enabled
        ? display === 'conversation'
          ? (activityLocation?.travelReply ?? '我这就去应战')
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

export function SweepEntryAction({
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, navigate } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() =>
        navigate(createSectRoomNpcHref('/game/sect/gate', 'facility'))
      }
    >
      {action.enabled
        ? display === 'conversation'
          ? '我这就去办'
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

export function MiningEntryAction({
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, navigate } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() =>
        navigate(createSectRoomNpcHref('/game/sect/spirit-vein', 'facility'))
      }
    >
      {action.enabled
        ? display === 'conversation'
          ? '我这就去灵脉采掘'
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

export function DungeonEntryAction({
  action,
  display,
}: SectTaskActionRendererProps) {
  const { busy, navigate } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      className={actionClassName(display)}
      disabled={busy || !action.enabled}
      onClick={() => navigate('/game/map?intent=sect-dungeon')}
    >
      {action.enabled
        ? display === 'conversation'
          ? '弟子这就去探查秘境'
          : action.label
        : (action.disabledReason ?? '尚未解锁')}
    </InkButton>
  );
}

export function ItemDeliveryAction(props: SectTaskActionRendererProps) {
  const [open, setOpen] = useState(false);
  const { busy } = useSectTaskInteraction();
  return (
    <>
      <InkButton
        variant="primary"
        className={actionClassName(props.display)}
        disabled={busy || !props.action.enabled}
        onClick={() => setOpen(true)}
      >
        {props.action.enabled
          ? props.display === 'conversation'
            ? '东西已经备好，请替我查验'
            : props.action.label
          : (props.action.disabledReason ?? '尚未解锁')}
      </InkButton>
      <SectTaskSubmissionDialog
        open={open}
        task={props.task}
        action={props.action}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
