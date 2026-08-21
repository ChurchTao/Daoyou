import { useStoryNpcDialogue } from '@app/lib/story/useStoryNpcDialogue';
import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
  type NpcConversationOption,
} from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import {
  useSectPromotionEvaluationQuery,
  useSectTasksQuery,
} from '@app/components/feature/sect/sectResources';
import { SectTaskActionRenderer } from '@app/components/feature/sect/SectTaskActionRenderer';
import { useSectTaskInteraction } from '@app/components/feature/sect/SectTaskInteractionProvider';
import {
  decodeSectTaskOutcome,
  readRewardReceiptOutcome,
} from '@app/components/feature/sect/sectTaskOutcomeRegistry';
import type { SectTaskViewData } from '@shared/contracts/sect';
import {
  describeSectPromotionStatus,
  SECT_RANK_LABELS,
  STANDARD_SECT_PRESENTATION,
  type SectAffairsTaskKind,
  type SectDiscipleRank,
  type SectRoomActorDefinition,
  type SectTaskDialogueEmphasis,
  type SectTaskDialogueSegment,
} from '@shared/engine/sect';
import { useEffect, useMemo, useState } from 'react';

const TASK_KINDS: readonly SectAffairsTaskKind[] = [
  'daily',
  'weekly',
  'promotion',
];

const STATE_ORDER: Record<SectTaskViewData['state'], number> = {
  claimable: 0,
  active: 1,
  offered: 2,
  claimed: 3,
  locked: 4,
};

const SEGMENT_CLASS: Record<SectTaskDialogueEmphasis, string> = {
  quantity: 'text-crimson font-medium',
  quality: 'text-tier-xuan font-medium',
  effect: 'text-teal font-medium',
  appearance: 'text-crimson font-medium',
  warning: 'text-crimson font-medium',
};

const LEAVE_CONVERSATION_OPTION = 'leave-conversation';
const RETURN_TO_TASKS_OPTION = 'return-to-tasks';
const PROMOTE_OPTION = 'promote-disciple';

function taskKey(task: SectTaskViewData): string {
  return `${task.periodKey}:${task.definitionId}`;
}

function sortTasks(tasks: readonly SectTaskViewData[]): SectTaskViewData[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        STATE_ORDER[left.task.state] - STATE_ORDER[right.task.state] ||
        left.index - right.index,
    )
    .map(({ task }) => task);
}

function visibleTasks(tasks: readonly SectTaskViewData[]): SectTaskViewData[] {
  return tasks.filter((task) => task.state !== 'locked');
}

function taskTitles(tasks: readonly SectTaskViewData[]): string {
  return tasks.map((task) => `「${task.presentation.title}」`).join('、');
}

function npcOpening(
  npc: SectRoomActorDefinition,
  tasks: readonly SectTaskViewData[],
  guidance?: string,
): string {
  const visible = visibleTasks(tasks);
  const clauses = [
    visible.some((task) => task.state === 'offered')
      ? `眼下可接的有${taskTitles(visible.filter((task) => task.state === 'offered'))}`
      : undefined,
    visible.some((task) => task.state === 'active')
      ? `${taskTitles(visible.filter((task) => task.state === 'active'))}还在你名下`
      : undefined,
    visible.some((task) => task.state === 'claimable')
      ? `${taskTitles(visible.filter((task) => task.state === 'claimable'))}已经可以交回`
      : undefined,
  ].filter((clause): clause is string => Boolean(clause));

  const taskStatus =
    clauses.length > 0
      ? `${clauses.join('；')}。`
      : visible.some((task) => task.state === 'claimed')
        ? '本期差事都已结清，若要查账便问我。'
        : '眼下没有需要你经办的事务。';
  return [npc.greeting, taskStatus, guidance].filter(Boolean).join(' ');
}

function taskReply(task: SectTaskViewData): string {
  const dialogue = task.presentation.dialogue;
  if (task.state === 'offered') return dialogue.offeredReply;
  if (task.state === 'active') return dialogue.activeReply;
  if (task.state === 'claimable') return dialogue.claimableReply;
  return dialogue.claimedReply;
}

function TaskInstruction({
  segments,
}: {
  segments: readonly SectTaskDialogueSegment[];
}) {
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${index}:${segment.text}`}
          className={
            segment.emphasis ? SEGMENT_CLASS[segment.emphasis] : undefined
          }
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

const affairsConversationRegistry = new SectNpcConversationRegistry([
  {
    key: 'sect.affairs.tasks',
    renderer: SectAffairsNpcConversationRenderer,
  },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.affairs);

export function SectAffairsRoom() {
  return (
    <SectRoutedRoom
      roomKey="affairs"
      registry={affairsConversationRegistry}
      eyebrow="宗门公牍 · 当值录事"
      prompt="点击人物，与其交谈"
    />
  );
}

function SectAffairsNpcConversationRenderer({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const interaction = useSectTaskInteraction();
  const kind = TASK_KINDS.find((candidate) => candidate === parameters.kind);
  const clearOutcome = interaction.clearOutcome;
  useEffect(() => {
    clearOutcome();
  }, [clearOutcome]);
  if (!kind)
    return (
      <NpcConversation
        actor={actor}
        messages={[
          {
            id: 'invalid-kind',
            speaker: actor.name,
            body: '这册事务暂时无法查验，请稍后再来。',
            tone: 'attention',
          },
        ]}
        options={[{ id: 'leave', label: '弟子告退', tone: 'muted' }]}
        onSelectOption={onExit}
      />
    );
  return <SectAffairsNpcConversation kind={kind} npc={actor} onExit={onExit} />;
}

function SectAffairsNpcConversation({
  kind,
  npc,
  onExit,
}: {
  kind: SectAffairsTaskKind;
  npc: SectRoomActorDefinition;
  onExit(): void;
}) {
  const interaction = useSectTaskInteraction();
  const storyDialogue = useStoryNpcDialogue('sect.affairs', npc.name);
  const current = useSectPromotionEvaluationQuery(kind === 'promotion');
  const { data, loading, error } = useSectTasksQuery();
  const [selectedTaskKey, setSelectedTaskKey] = useState<string>();
  const [promotionResult, setPromotionResult] = useState<string>();
  const session = useConversationSession({
    sessionKey: `${npc.id}:${kind}`,
    snapshot: data,
    perform: async () => undefined,
    onReset: () => {
      setSelectedTaskKey(undefined);
      setPromotionResult(undefined);
    },
  });

  const tasks = useMemo(
    () => sortTasks(data?.items.filter((task) => task.kind === kind) ?? []),
    [data?.items, kind],
  );
  const selectedTask = tasks.find((task) => taskKey(task) === selectedTaskKey);
  const promotionGuidance =
    kind === 'promotion' && current.data
      ? describeSectPromotionStatus({
          nextRank: current.data.nextRank,
          missingRequirements: current.data.missing,
        })
      : undefined;
  const nextRank = kind === 'promotion' ? current.data?.nextRank : null;
  const canPromote = Boolean(nextRank) && current.data?.missing.length === 0;

  const promote = async () => {
    if (!nextRank || !canPromote) return;
    const result = await interaction.runRaw<{
      discipleRank?: SectDiscipleRank;
    }>(
      '/api/sects/current/promotion',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      },
      `已晋升${SECT_RANK_LABELS[nextRank]}`,
    );
    if (result) {
      setPromotionResult(
        `你的身份玉牒已经改录为${SECT_RANK_LABELS[result.discipleRank ?? nextRank]}。`,
      );
    }
  };

  const selectTask = async (task: SectTaskViewData) => {
    interaction.clearOutcome();
    if (task.state === 'offered') {
      const action = task.actions.find(
        (candidate) => candidate.key === 'accept',
      );
      if (!action?.enabled) return;
      const result = await interaction.execute(
        task,
        action,
        {},
        `已接下「${task.presentation.title}」`,
      );
      if (result) setSelectedTaskKey(taskKey(result.primaryTask));
      return;
    }
    if (task.state === 'claimable') {
      const action = task.actions.find(
        (candidate) => candidate.key === 'claim',
      );
      if (!action?.enabled) return;
      const result = await interaction.execute(
        task,
        action,
        {},
        `「${task.presentation.title}」已结清`,
      );
      if (result) setSelectedTaskKey(taskKey(result.primaryTask));
      return;
    }
    setSelectedTaskKey(taskKey(task));
  };

  if (!data && loading)
    return (
      <NpcConversation
        actor={npc}
        messages={[
          {
            id: 'loading',
            speaker: npc.name,
            body: '稍候，我查一查今日的功簿。',
          },
        ]}
        busy
        onSelectOption={() => undefined}
      />
    );

  return selectedTask ? (
    <TaskConversation
      npc={npc}
      task={selectedTask}
      onExit={onExit}
      onBack={() => {
        interaction.clearOutcome();
        setSelectedTaskKey(undefined);
      }}
    />
  ) : (
    <TaskListConversation
      npc={npc}
      tasks={tasks}
      guidance={promotionGuidance}
      promotionResult={promotionResult}
      nextRank={canPromote ? nextRank : null}
      busy={
        interaction.busy ||
        loading ||
        session.phase === 'loading' ||
        (kind === 'promotion' && current.loading)
      }
      error={
        interaction.error ??
        session.error ??
        error ??
        (kind === 'promotion' ? current.error : undefined)
      }
      onSelect={(task) => void selectTask(task)}
      onPromote={() => void promote()}
      storyDialogue={storyDialogue}
      onExit={onExit}
    />
  );
}

function TaskListConversation({
  npc,
  tasks,
  guidance,
  promotionResult,
  nextRank,
  busy,
  error,
  onSelect,
  onPromote,
  storyDialogue,
  onExit,
}: {
  npc: SectRoomActorDefinition;
  tasks: readonly SectTaskViewData[];
  guidance?: string;
  promotionResult?: string;
  nextRank?: SectDiscipleRank | null;
  busy: boolean;
  error?: string;
  onSelect(task: SectTaskViewData): void;
  onPromote(): void;
  storyDialogue: ReturnType<typeof useStoryNpcDialogue>;
  onExit(): void;
}) {
  const visible = visibleTasks(tasks);
  const options: NpcConversationOption[] = [
    ...visible.map((task) => ({
      id: taskKey(task),
      label: taskReply(task),
      tone:
        task.state === 'claimable'
          ? ('primary' as const)
          : task.state === 'claimed'
            ? ('muted' as const)
            : ('normal' as const),
    })),
    ...(nextRank
      ? [
          {
            id: PROMOTE_OPTION,
            label: `请长老为弟子晋升${SECT_RANK_LABELS[nextRank]}`,
            tone: 'primary' as const,
          },
        ]
      : []),
    ...storyDialogue.options,
    {
      id: LEAVE_CONVERSATION_OPTION,
      label: '弟子告退',
      tone: 'muted',
    },
  ];
  const messages: NpcConversationMessage[] = [
    {
      id: 'greeting',
      speaker: npc.name,
      body: npcOpening(npc, tasks, guidance),
    },
    ...storyDialogue.messages,
  ];
  if (promotionResult)
    messages.push({
      id: 'promotion-result',
      speaker: npc.name,
      body: promotionResult,
      tone: 'attention',
    });
  const taskByKey = new Map(visible.map((task) => [taskKey(task), task]));

  return (
    <NpcConversation
      actor={npc}
      messages={messages}
      options={options}
      busy={busy || storyDialogue.busy}
      error={storyDialogue.error ?? error}
      onSelectOption={(optionId) => {
        void (async () => {
          if (await storyDialogue.handleOption(optionId)) return;
          if (optionId === LEAVE_CONVERSATION_OPTION) {
            onExit();
            return;
          }
          if (optionId === PROMOTE_OPTION) {
            onPromote();
            return;
          }
          const task = taskByKey.get(optionId);
          if (task) onSelect(task);
        })();
      }}
    />
  );
}

function TaskConversation({
  npc,
  task,
  onBack,
  onExit,
}: {
  npc: SectRoomActorDefinition;
  task: SectTaskViewData;
  onBack(): void;
  onExit(): void;
}) {
  const interaction = useSectTaskInteraction();
  const outcomeTask =
    interaction.outcome?.task.definitionId === task.definitionId
      ? interaction.outcome.task
      : undefined;
  const currentTask = outcomeTask ?? task;
  const currentOutcome =
    interaction.outcome?.task.definitionId === task.definitionId
      ? interaction.outcome.outcome
      : undefined;
  const decoded = currentOutcome
    ? decodeSectTaskOutcome(currentOutcome)
    : undefined;
  const receipt =
    decoded?.ok === true ? readRewardReceiptOutcome(decoded.value) : undefined;

  const messages: NpcConversationMessage[] = [];
  if (receipt) {
    messages.push({
      id: 'reward-receipt',
      speaker: npc.name,
      body: `此事已经结清。${receipt.lines.join('，')}，均已入账。`,
      tone: 'attention',
    });
  } else if (currentTask.state === 'claimed') {
    messages.push({
      id: 'claimed',
      speaker: npc.name,
      body: (
        <>
          此事本期已经结清。
          {currentTask.reward?.summary.length
            ? `${currentTask.reward.summary.join('，')}，都已记入功簿。`
            : '功簿上已经留有记录。'}
        </>
      ),
    });
  } else if (
    decoded?.ok &&
    decoded.value.renderer === 'sect.outcome.fulfilled'
  ) {
    messages.push({
      id: 'fulfilled',
      speaker: npc.name,
      body: '带来的东西已经验明，回执也已写好，现在可以交回结清。',
      tone: 'attention',
    });
  } else if (
    decoded?.ok &&
    decoded.value.renderer === 'sect.outcome.abandoned'
  ) {
    messages.push({
      id: 'abandoned',
      speaker: npc.name,
      body: '这份委托已经从你名下撤下。若仍想经办，可以回到事务册重新领取。',
      tone: 'attention',
    });
  } else {
    messages.push({
      id: 'instruction',
      speaker: npc.name,
      body: (
        <TaskInstruction
          segments={currentTask.presentation.dialogue.instruction}
        />
      ),
    });
    if (currentTask.battleTarget)
      messages.push({
        id: 'battle-target',
        speaker: npc.name,
        body: `目标：${currentTask.battleTarget.name}，${currentTask.battleTarget.sectName ? `${currentTask.battleTarget.sectName}，` : ''}${currentTask.battleTarget.realm}${currentTask.battleTarget.realmStage}。${currentTask.battleTarget.description}`,
        tone: 'attention',
      });
  }

  if (decoded?.ok === false) {
    messages.push({
      id: 'outcome-error',
      body: decoded.error,
      tone: 'attention',
    });
  }

  const visibleActions =
    currentTask.state === 'active' || currentTask.state === 'claimable'
      ? currentTask.actions
      : [];
  const options: NpcConversationOption[] = [
    {
      id: RETURN_TO_TASKS_OPTION,
      label: '我再问问别的',
    },
    {
      id: LEAVE_CONVERSATION_OPTION,
      label: '弟子告退',
      tone: 'muted',
    },
  ];

  return (
    <NpcConversation
      actor={npc}
      messages={messages}
      busy={interaction.busy}
      error={interaction.error}
      actions={
        visibleActions.length > 0
          ? visibleActions.map((action) => (
              <SectTaskActionRenderer
                key={action.key}
                task={currentTask}
                action={action}
                display="conversation"
              />
            ))
          : undefined
      }
      options={options}
      onSelectOption={(optionId) => {
        if (optionId === RETURN_TO_TASKS_OPTION) {
          onBack();
          return;
        }
        if (optionId === LEAVE_CONVERSATION_OPTION) onExit();
      }}
    />
  );
}
