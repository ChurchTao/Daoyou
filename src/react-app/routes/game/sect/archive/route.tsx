import { StorySurfaceSlot } from '@app/components/feature/story/StorySurfaceSlot';
import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
} from '@app/components/feature/room';
import {
  buildSectProgressionState,
  getSectDefinition,
  useSectContextQuery,
  useSectInfrastructureQuery,
  useSectProgressionQuery,
} from '@app/components/feature/sect/sectResources';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { InkButton } from '@app/components/ui';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useStoryNpcDialogue } from '@app/lib/story/useStoryNpcDialogue';
import {
  getEffectiveSectMethodLevelCap,
  STANDARD_SECT_PRESENTATION,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { useState } from 'react';
import { MethodsTab } from '../components/MethodsTab';
import {
  SectPermissionBoundary,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.archive.methods', renderer: ArchiveConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.archive);

export default function SectArchivePage() {
  return (
    <SectPermissionBoundary permission="sect.archive.use" sceneKey="archive">
      <SectScene sceneKey="archive" mood="archive">
        <SectRoutedRoom
          roomKey="archive"
          registry={registry}
          eyebrow="传承经卷 · 研习次第"
        />
        <StorySurfaceSlot surface="sect.archive" />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function ArchiveConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const storyDialogue = useStoryNpcDialogue('sect.archive', actor.name);
  const infrastructure = useSectInfrastructureQuery();
  const progression = useSectProgressionQuery();
  const profile = useCultivatorIdentity();
  const cultivator = profile.data?.cultivator;
  const mutation = useSectMutation();
  const [topic, setTopic] = useState<'limit' | 'workspace'>();
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: {
      context: context.data,
      infrastructure: infrastructure.data,
      progression: progression.data,
      profile: profile.data,
    },
    perform: async () => undefined,
    onReset: () => setTopic(undefined),
  });
  const data =
    context.data && infrastructure.data && progression.data && cultivator
      ? (() => {
          const module = productionSectRuntime.registry.require(
            context.data.sectId,
          );
          const facilityLevels = new Map(
            infrastructure.data.facilities.map((facility) => [
              facility.key,
              facility.level,
            ]),
          );
          const realmMethodLevelCap = productionSectRuntime
            .progressionFor(context.data.sectId)
            .methodLevelCap(cultivator.realm, cultivator.realm_stage);
          return {
            definition: getSectDefinition(context.data),
            sect: buildSectProgressionState(context.data, progression.data),
            methodLevelCap: getEffectiveSectMethodLevelCap({
              realmCap: realmMethodLevelCap,
              rank: context.data.discipleRank,
              facilityCap:
                module.organization.benefits.methodLevelCap(facilityLevels),
              rankCap: module.organization.ranks.methodLevelCap(
                context.data.discipleRank,
              ),
            }),
            realmMethodLevelCap,
          };
        })()
      : undefined;
  if (topic === 'workspace' && data && cultivator)
    return (
      <div className="min-h-[34rem] px-5 py-7 sm:px-8 md:px-10">
        <div className="mb-5 flex justify-end border-b border-current/10 pb-4">
          <InkButton
            onClick={() => {
              setTopic(undefined);
              void session.reload();
            }}
          >
            合上经卷
          </InkButton>
        </div>
        <MethodsTab
          data={data}
          busy={mutation.busy}
          action={async (url, init) => {
            await mutation.run(url, init, '心法研习完成');
          }}
          realm={cultivator.realm}
        />
      </div>
    );
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (data?.definition)
    messages.push({
      id: 'catalog',
      speaker: actor.name,
      body: `阁中现有${data.definition.methods.map((method) => `${method.name}`).join('、')}，都可逐卷查问。`,
    });
  if (topic === 'limit' && data)
    messages.push({
      id: 'limit',
      speaker: actor.name,
      body: (
        <>
          你当前最多可将宗门心法研习至
          <span className="text-crimson font-medium">
            {data.methodLevelCap}级
          </span>
          ，其中境界所允许的上限是
          {data.realmMethodLevelCap}级。
          若经卷、身份或境界有所不足，展开经卷时会逐项说明。
        </>
      ),
    });
  messages.push(...storyDialogue.messages);
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[
        { id: 'limit', label: '请长老说说我当前的研习上限' },
        { id: 'workspace', label: '弟子想展开经卷研习' },
        ...storyDialogue.options,
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      busy={session.phase === 'loading' || storyDialogue.busy}
      error={
        storyDialogue.error ??
        session.error ??
        context.error ??
        infrastructure.error ??
        progression.error ??
        profile.error
      }
      onSelectOption={(optionId) => {
        void (async () => {
          if (await storyDialogue.handleOption(optionId)) return;
          if (optionId === 'leave') onExit();
          else if (optionId === 'limit' || optionId === 'workspace')
            setTopic(optionId);
        })();
      }}
    />
  );
}
