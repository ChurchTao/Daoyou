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
import {
  describeSectFacilityStatus,
  type SectFacilityDialogueEmphasis,
} from '@daoyou/game-rules/sect-organization';
import { useMemo } from 'react';
import type { SectNpcConversationRendererProps } from './SectNpcConversationRegistry';

const emphasisClass: Record<SectFacilityDialogueEmphasis, string> = {
  level: 'text-crimson font-medium',
  benefit: 'text-teal font-medium',
  progress: 'text-crimson font-medium',
  warning: 'text-crimson font-medium',
};

const readText = (
  parameters: Readonly<Record<string, unknown>>,
  key: string,
) => {
  const value = parameters[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export function SectFacilityStatusConversation({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const facilityKey = readText(parameters, 'facilityKey');
  const effectKey = readText(parameters, 'effectKey') ?? facilityKey;
  const detail = readText(parameters, 'detail');
  const snapshot = useMemo(
    () => ({
      context: context.data,
      infrastructure: infrastructure.data,
    }),
    [context.data, infrastructure.data],
  );
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot,
    perform: async () => undefined,
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
  const facilityLabel = facilityKey
    ? (presentation.facilityLabels[facilityKey] ?? '此处设施')
    : '此处设施';

  const messages: NpcConversationMessage[] = [
    {
      id: 'greeting',
      body: actor.greeting,
    },
  ];
  if (facility) {
    const segments = describeSectFacilityStatus({
      facilityLabel,
      facility,
      effect,
    });
    messages.push({
      id: 'status',
      body: (
        <>
          {segments.map((segment, index) => (
            <span
              key={`${index}:${segment.text}`}
              className={
                segment.emphasis ? emphasisClass[segment.emphasis] : undefined
              }
            >
              {segment.text}
            </span>
          ))}
          {detail}
        </>
      ),
    });
  } else if (!context.loading && !infrastructure.loading) {
    messages.push({
      id: 'missing-facility',
      body: '此处设施的值录暂未找到，请稍后再来。',
      tone: 'attention',
    });
  }

  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[{ id: 'leave', label: '返回房间', tone: 'muted' }]}
      busy={
        session.phase === 'loading' ||
        session.phase === 'submitting' ||
        context.loading ||
        infrastructure.loading
      }
      error={session.error ?? context.error ?? infrastructure.error}
      onSelectOption={onExit}
    />
  );
}
