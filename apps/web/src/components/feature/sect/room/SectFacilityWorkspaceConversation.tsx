import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
} from '@app/components/feature/room';
import {
  getSectPresentationForContext,
  resolveSectBenefits,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { createSectRoomNpcHref } from '@app/components/feature/sect/sectRoomNavigation';
import { describeSectFacilityStatus } from '@daoyou/shared/engine/sect';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SectNpcConversationRendererProps } from './SectNpcConversationRegistry';

function readText(
  parameters: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = parameters[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function SectFacilityWorkspaceConversation({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const navigate = useNavigate();
  const [showStatus, setShowStatus] = useState(false);
  const facilityKey = readText(parameters, 'facilityKey');
  const effectKey = readText(parameters, 'effectKey') ?? facilityKey;
  const workspaceHref = readText(parameters, 'workspaceHref');
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: { context: context.data, infrastructure: infrastructure.data },
    perform: async () => undefined,
    onReset: () => setShowStatus(false),
  });
  const facility = facilityKey
    ? infrastructure.data?.facilities.find(
        (candidate) => candidate.key === facilityKey,
      )
    : undefined;
  const effect = effectKey
    ? context.data && infrastructure.data
      ? resolveSectBenefits(context.data, infrastructure.data).facilityEffects[
          effectKey
        ]
      : undefined
    : undefined;
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (showStatus && facility && facilityKey)
    messages.push({
      id: 'status',
      speaker: actor.name,
      body: describeSectFacilityStatus({
        facilityLabel: presentation.facilityLabels[facilityKey] ?? '此处设施',
        facility,
        effect,
      })
        .map((segment) => segment.text)
        .join(''),
    });
  if (!facilityKey || !workspaceHref)
    messages.push({
      id: 'invalid',
      body: '此处炉室的封签尚未核准，暂时无法开炉。',
      tone: 'attention',
    });
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[
        {
          id: 'status',
          label: readText(parameters, 'statusReply') ?? '请说说此地设施灵效',
        },
        {
          id: 'workspace',
          label: readText(parameters, 'workspaceReply') ?? '请为我开启工坊',
          disabled: !workspaceHref,
        },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      busy={session.phase === 'loading'}
      error={session.error ?? context.error ?? infrastructure.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'status') setShowStatus(true);
        else if (optionId === 'workspace' && workspaceHref)
          navigate(createSectRoomNpcHref(workspaceHref, actor.roleKey));
      }}
    />
  );
}
