import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
  type NpcConversationOption,
} from '@app/components/feature/room';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import {
  createSectTaskBattleHref,
  isSectTaskActivityLocationKey,
  readSectTaskActivityLocation,
} from '@app/components/feature/sect/sectTaskActivityLocations';
import { useNavigate } from 'react-router';
import type { SectNpcConversationRendererProps } from './SectNpcConversationRegistry';

export function SectTaskLocationConversation({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const tasks = useSectTasksQuery();
  const navigate = useNavigate();
  const rawLocationKey = parameters.locationKey;
  const locationKey = isSectTaskActivityLocationKey(rawLocationKey)
    ? rawLocationKey
    : undefined;
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: tasks.data,
    perform: async () => undefined,
  });
  const task = locationKey
    ? tasks.data?.items.find(
        (candidate) =>
          (candidate.state === 'active' || candidate.state === 'claimable') &&
          candidate.actions.some(
            (action) =>
              readSectTaskActivityLocation(action)?.key === locationKey,
          ),
      )
    : undefined;
  const battleAction = task?.actions.find(
    (action) =>
      action.renderer === 'sect.action.battle' &&
      readSectTaskActivityLocation(action)?.key === locationKey,
  );
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (!locationKey)
    messages.push({
      id: 'invalid-location',
      body: '今日场地封签有误，暂时无法入场。',
      tone: 'attention',
    });
  else if (!task)
    messages.push({
      id: 'idle',
      speaker: actor.name,
      body: '你名下眼下没有需要在这里办理的事务。',
    });
  else if (task.state === 'claimable')
    messages.push({
      id: 'claimable',
      speaker: actor.name,
      body: `${task.presentation.title}的回执已经写成，该回事务堂复命了。`,
      tone: 'attention',
    });
  else
    messages.push({
      id: 'active',
      speaker: actor.name,
      body: task.presentation.dialogue.instruction
        .map((segment) => segment.text)
        .join(''),
    });
  if (task?.state === 'active' && task.battleTarget)
    messages.push({
      id: 'battle-target',
      speaker: actor.name,
      body: `本次对手是${task.battleTarget.name}，${task.battleTarget.realm}${task.battleTarget.realmStage}。${task.battleTarget.description}`,
      tone: 'attention',
    });
  const options: NpcConversationOption[] = [
    ...(task?.state === 'active' && battleAction?.enabled
      ? [
          {
            id: 'start',
            label: battleAction.label,
            tone: 'primary' as const,
          },
        ]
      : []),
    { id: 'leave', label: '弟子告退', tone: 'muted' },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={options}
      busy={session.phase === 'loading'}
      error={session.error ?? tasks.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (
          optionId === 'start' &&
          locationKey &&
          task &&
          battleAction?.enabled
        )
          navigate(createSectTaskBattleHref(task.definitionId, locationKey));
      }}
    />
  );
}
