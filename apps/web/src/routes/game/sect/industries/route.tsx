import { apiFetch } from '@app/lib/api/fetch';
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
  getSectPresentationForContext,
  useSectConstructionMemberQuery,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  quoteSectConstructionDonation,
  SECT_CONSTRUCTION_DONATION_OPTIONS,
  STANDARD_SECT_PRESENTATION,
  type SectConstructionDonationAmount,
  type SectFacilityState,
} from '@daoyou/game-rules/sect-organization';
import { useMemo, useState } from 'react';
import {
  postJson,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  {
    key: 'sect.industries.construction',
    renderer: ConstructionConversation,
  },
  { key: 'sect.industries.donation', renderer: DonationConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.industries);

export default function SectIndustriesPage() {
  return (
    <SectPermissionBoundary
      permission="sect.construction.view"
      sceneKey="industries"
    >
      <SectScene sceneKey="industries" mood="industries">
        <SectRoutedRoom
          roomKey="industries"
          registry={registry}
          eyebrow="宗门设施 · 常态建设"
        />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function ConstructionConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const facilities = buildableFacilities(infrastructure.data?.facilities);
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
    {
      id: 'facilities',
      speaker: actor.name,
      body: facilities.length
        ? facilities
            .map((facility) =>
              describeFacility(
                presentation.facilityLabels[facility.key] ?? '未命名设施',
                facility,
              ),
            )
            .join('；')
            .concat('。')
        : '宗门当前没有可继续建设的设施。',
    },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[{ id: 'leave', label: '弟子告退', tone: 'muted' }]}
      busy={infrastructure.loading}
      error={infrastructure.error}
      onSelectOption={() => onExit()}
    />
  );
}

function DonationConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const member = useSectConstructionMemberQuery();
  const presentation = getSectPresentationForContext(context.data);
  const { mutate } = useResourceMutation();
  const [facilityKey, setFacilityKey] = useState<string>();
  const [spiritStones, setSpiritStones] =
    useState<SectConstructionDonationAmount>();
  const facilities = useMemo(
    () => buildableFacilities(infrastructure.data?.facilities),
    [infrastructure.data?.facilities],
  );
  const facility = facilities.find(
    (candidate) => candidate.key === facilityKey,
  );
  const quote =
    spiritStones === undefined
      ? undefined
      : quoteSectConstructionDonation(spiritStones);
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: {
      facilities,
      member: member.data,
    },
    perform: async () => {
      if (!facility || !quote) throw new Error('请先选择设施和灵石档位。');
      await mutate(
        apiFetch(
          '/api/sects/current/construction/donate',
          postJson({
            facilityKey: facility.key,
            spiritStones: quote.spiritStones,
          }),
        ),
      );
      return presentation.facilityLabels[facility.key] ?? '所选设施';
    },
    onReset: () => {
      setFacilityKey(undefined);
      setSpiritStones(undefined);
    },
  });

  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (member.data?.constructedToday)
    messages.push({
      id: 'used',
      speaker: actor.name,
      body: `今日建设已经完成：向${presentation.facilityLabels[member.data.facilityKey ?? ''] ?? '所选设施'}捐献${formatSpiritStones(member.data.spiritStones ?? 0)}灵石，获得${member.data.contribution ?? 0}点宗门贡献。`,
      tone: 'attention',
    });
  else if (facility)
    messages.push({
      id: 'facility',
      speaker: actor.name,
      body: `今日准备建设${presentation.facilityLabels[facility.key] ?? '所选设施'}。${describeFacility('', facility)}`,
    });
  if (quote)
    messages.push({
      id: 'quote',
      speaker: actor.name,
      body: `本次需要捐献${formatSpiritStones(quote.spiritStones)}灵石，可增加${quote.constructionPoints}点建设进度并获得${quote.contribution}点宗门贡献。`,
    });
  if (session.result)
    messages.push({
      id: 'result',
      speaker: actor.name,
      body: `${session.result}的建设已经登记，灵石与贡献均已结算。`,
      tone: 'attention',
    });

  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={donationOptions({
        facilities,
        facility,
        spiritStones,
        constructedToday: member.data?.constructedToday ?? false,
        facilityLabels: presentation.facilityLabels,
      })}
      busy={
        infrastructure.loading ||
        member.loading ||
        session.phase === 'submitting'
      }
      error={session.error ?? infrastructure.error ?? member.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'back-facility') {
          setFacilityKey(undefined);
          setSpiritStones(undefined);
        } else if (optionId === 'back-amount') {
          setSpiritStones(undefined);
        } else if (optionId === 'confirm') {
          void session.dispatch({});
        } else if (optionId.startsWith('facility:')) {
          setFacilityKey(optionId.slice('facility:'.length));
          setSpiritStones(undefined);
        } else if (optionId.startsWith('amount:')) {
          setSpiritStones(
            Number(
              optionId.slice('amount:'.length),
            ) as SectConstructionDonationAmount,
          );
        }
      }}
    />
  );
}

function buildableFacilities(
  facilities: readonly SectFacilityState[] | undefined,
): SectFacilityState[] {
  return (
    facilities?.filter(
      (facility) => facility.upgradeable && facility.level < facility.maxLevel,
    ) ?? []
  );
}

function describeFacility(label: string, facility: SectFacilityState): string {
  const prefix = label ? `${label}当前${facility.level}级，` : '';
  return facility.target === null
    ? `${prefix}已经满级`
    : `${prefix}建设进度${facility.progress}/${facility.target}`;
}

function formatSpiritStones(amount: number): string {
  return amount % 10_000 === 0
    ? `${amount / 10_000}万`
    : amount.toLocaleString('zh-CN');
}

function donationOptions(input: {
  facilities: readonly SectFacilityState[];
  facility: SectFacilityState | undefined;
  spiritStones: SectConstructionDonationAmount | undefined;
  constructedToday: boolean;
  facilityLabels: Readonly<Record<string, string>>;
}): NpcConversationOption[] {
  if (input.constructedToday || input.facilities.length === 0)
    return [{ id: 'leave', label: '弟子告退', tone: 'muted' }];
  if (!input.facility)
    return [
      ...input.facilities.map((facility) => ({
        id: `facility:${facility.key}`,
        label: `建设${input.facilityLabels[facility.key] ?? '这项设施'}`,
      })),
      { id: 'leave', label: '弟子告退', tone: 'muted' as const },
    ];
  if (input.spiritStones === undefined)
    return [
      ...SECT_CONSTRUCTION_DONATION_OPTIONS.map((option) => ({
        id: `amount:${option.spiritStones}`,
        label: `捐献${formatSpiritStones(option.spiritStones)}灵石`,
      })),
      { id: 'back-facility', label: '改选设施' },
      { id: 'leave', label: '弟子告退', tone: 'muted' as const },
    ];
  return [
    {
      id: 'confirm',
      label: '确认建设',
      tone: 'primary',
    },
    { id: 'back-amount', label: '改选灵石档位' },
    { id: 'back-facility', label: '改选设施' },
    { id: 'leave', label: '弟子告退', tone: 'muted' },
  ];
}
