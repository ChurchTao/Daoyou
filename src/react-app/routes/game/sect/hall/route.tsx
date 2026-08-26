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
  useSectContextQuery,
  useSectContributionRankingQuery,
  useSectMembersQuery,
  useSectStipendQuery,
} from '@app/components/feature/sect/sectResources';
import { InkBadge, InkButton, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type {
  SectContributionRankingData,
  SectMembersData,
} from '@shared/contracts/sect';
import {
  SECT_RANK_LABELS,
  STANDARD_SECT_PRESENTATION,
} from '@shared/engine/sect';
import { useEffect, useState } from 'react';
import {
  postJson,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.hall.registry', renderer: HallRegistryConversation },
  { key: 'sect.hall.stipend', renderer: HallStipendConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.hall);

export default function SectHallPage() {
  return (
    <SectPermissionBoundary permission="sect.hall.view" sceneKey="hall">
      <SectScene sceneKey="hall" mood="hall">
        <SectRoutedRoom
          roomKey="hall"
          registry={registry}
          eyebrow="身份玉牒 · 俸册名录"
        />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function HallRegistryConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const current = useSectContextQuery();
  const [topic, setTopic] = useState<
    'identity' | 'members' | 'announcement' | 'ranking'
  >();
  const [memberPage, setMemberPage] = useState(1);
  const members = useSectMembersQuery(
    { page: memberPage, pageSize: 20 },
    topic === 'members',
  );
  const ranking = useSectContributionRankingQuery(topic === 'ranking');
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: {
      current: current.data,
      members: members.data,
      ranking: ranking.data,
    },
    perform: async () => undefined,
    onReset: () => {
      setTopic(undefined);
      setMemberPage(1);
    },
  });
  const sect = current.data;
  const presentation = getSectPresentationForContext(sect);
  const reloadMembers = members.reload;

  useEffect(() => {
    if (topic !== 'members') return;
    const timer = setInterval(() => void reloadMembers(), 30_000);
    return () => clearInterval(timer);
  }, [reloadMembers, topic]);

  if (topic === 'members' && members.data)
    return (
      <MemberRegistryWorkspace
        members={members.data}
        refreshing={members.isRefreshing}
        onPageChange={setMemberPage}
        onBack={() => {
          setTopic(undefined);
          setMemberPage(1);
          void session.reload();
        }}
      />
    );
  if (topic === 'ranking' && ranking.data)
    return (
      <ContributionRankingWorkspace
        ranking={ranking.data}
        refreshing={ranking.isRefreshing}
        onRefresh={() => void ranking.reload()}
        onBack={() => {
          setTopic(undefined);
          void session.reload();
        }}
      />
    );

  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (topic === 'identity' && sect) {
    const rank = sect.discipleRank ?? 'registered';
    messages.push({
      id: 'identity',
      speaker: actor.name,
      body: (
        <>
          玉牒上记的是
          <span className="text-crimson font-medium">
            {SECT_RANK_LABELS[rank]}
          </span>
          ，功簿尚余
          <span className="text-crimson font-medium">
            {sect.contribution.toLocaleString('zh-CN')}点贡献
          </span>
          。若要问晋升条件或正式晋升，去事务堂请教传功长老即可。
        </>
      ),
    });
  }
  if (topic === 'announcement') {
    messages.push({
      id: 'announcement',
      speaker: actor.name,
      body: presentation.announcement,
      tone: 'attention',
    });
  }
  const options: NpcConversationOption[] = [
    { id: 'identity', label: '请执事替我查验身份玉牒' },
    { id: 'members', label: '我想翻看同门名录' },
    { id: 'announcement', label: '请问宗门近来有何公告' },
    { id: 'ranking', label: '我想查看宗门贡献榜' },
    { id: 'leave', label: '弟子告退', tone: 'muted' },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={options}
      busy={session.phase === 'loading'}
      error={session.error ?? current.error ?? members.error ?? ranking.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (
          optionId === 'identity' ||
          optionId === 'members' ||
          optionId === 'announcement' ||
          optionId === 'ranking'
        )
          setTopic(optionId);
      }}
    />
  );
}

function MemberRegistryWorkspace({
  members,
  refreshing,
  onPageChange,
  onBack,
}: {
  members: SectMembersData;
  refreshing: boolean;
  onPageChange(page: number): void;
  onBack(): void;
}) {
  const totalPages = Math.max(1, Math.ceil(members.total / members.pageSize));
  return (
    <div className="min-h-[34rem] px-5 py-7 sm:px-8 md:px-10">
      <div className="flex items-center justify-between gap-3 border-b border-current/10 pb-4">
        <p className="text-ink-secondary text-sm">
          同门名录 · 共 {members.total} 人 · 第 {members.page}/{totalPages} 页
          {refreshing ? ' · 正在更新' : ''}
        </p>
        <InkButton onClick={onBack}>合上名录</InkButton>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-ink/20 border-b">
            <tr>
              <th className="p-2">名号</th>
              <th className="p-2">境界</th>
              <th className="p-2">身份</th>
              <th className="p-2">职务</th>
              <th className="p-2">近况</th>
            </tr>
          </thead>
          <tbody>
            {members.items.map((member) => (
              <tr key={member.cultivatorId} className="border-ink/10 border-b">
                <td className="p-2 font-semibold">{member.name}</td>
                <td className="p-2">
                  {member.realm}
                  {member.realmStage}
                </td>
                <td className="p-2">{SECT_RANK_LABELS[member.discipleRank]}</td>
                <td className="p-2">
                  {member.office === 'none' ? '无' : member.office}
                </td>
                <td className="p-2">
                  <ActivityBadge state={member.activityState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <InkButton
          variant="secondary"
          disabled={members.page <= 1}
          onClick={() => onPageChange(members.page - 1)}
        >
          上一页
        </InkButton>
        <InkButton
          variant="secondary"
          disabled={members.page >= totalPages}
          onClick={() => onPageChange(members.page + 1)}
        >
          下一页
        </InkButton>
      </div>
    </div>
  );
}

const ACTIVITY_LABELS = {
  online: '在线',
  active_today: '今日活跃',
  active_7d: '近7日活跃',
  inactive: '较久未现身',
} as const;

function ActivityBadge({ state }: { state: keyof typeof ACTIVITY_LABELS }) {
  return (
    <InkBadge tone={state === 'online' ? 'accent' : 'default'}>
      {ACTIVITY_LABELS[state]}
    </InkBadge>
  );
}

function ContributionRankingWorkspace({
  ranking,
  refreshing,
  onRefresh,
  onBack,
}: {
  ranking: SectContributionRankingData;
  refreshing: boolean;
  onRefresh(): void;
  onBack(): void;
}) {
  return (
    <div className="min-h-[34rem] px-5 py-7 sm:px-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-4">
        <div>
          <p className="text-ink-secondary text-sm">宗门贡献榜 · 累积贡献</p>
          <p className="mt-1 text-sm">
            我的排名：第 {ranking.currentMember.rank} 名 ·{' '}
            {ranking.currentMember.contribution.toLocaleString('zh-CN')} 点
          </p>
        </div>
        <div className="flex gap-2">
          <InkButton
            variant="secondary"
            onClick={onRefresh}
            pending={refreshing}
            pendingLabel="更新中……"
          >
            刷新
          </InkButton>
          <InkButton onClick={onBack}>收起榜单</InkButton>
        </div>
      </div>
      {ranking.entries.length === 0 ? (
        <InkNotice className="mt-5">暂无贡献记录。</InkNotice>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-ink/20 border-b">
              <tr>
                <th className="p-2">名次</th>
                <th className="p-2">名号</th>
                <th className="p-2">身份</th>
                <th className="p-2">职务</th>
                <th className="p-2 text-right">累积贡献</th>
              </tr>
            </thead>
            <tbody>
              {ranking.entries.map((entry) => (
                <tr key={entry.cultivatorId} className="border-ink/10 border-b">
                  <td className="p-2">第 {entry.rank} 名</td>
                  <td className="p-2 font-semibold">{entry.name}</td>
                  <td className="p-2">
                    {SECT_RANK_LABELS[entry.discipleRank]}
                  </td>
                  <td className="p-2">
                    {entry.office === 'none' ? '无' : entry.office}
                  </td>
                  <td className="p-2 text-right">
                    {entry.contribution.toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HallStipendConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const current = useSectStipendQuery();
  const { mutate } = useResourceMutation();
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: current.data,
    perform: async ({ intent }: { intent: 'claim'; signal: AbortSignal }) => {
      if (intent !== 'claim') return undefined;
      await mutate(fetch('/api/sects/current/stipend/claim', postJson()));
      return 'claimed' as const;
    },
  });
  const stipend = current.data;
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (stipend) {
    messages.push({
      id: 'stipend',
      speaker: actor.name,
      body: stipend.claimed ? (
        session.result === 'claimed' ? (
          <>
            本周周俸已经入账，实际领取
            <span className="text-crimson font-medium">
              {stipend.spiritStones.toLocaleString('zh-CN')}枚灵石
            </span>
            。
          </>
        ) : (
          '本周周俸已经入账，俸册上没有欠项。'
        )
      ) : (
        <>
          本周应发
          <span className="text-crimson font-medium">
            {stipend.spiritStones.toLocaleString('zh-CN')}枚灵石
          </span>
          。核对无误便可领取。
        </>
      ),
      tone: session.result === 'claimed' ? 'attention' : 'normal',
    });
  }
  const options: NpcConversationOption[] = [
    ...(!stipend?.claimed
      ? [{ id: 'claim', label: '有劳执事将本周俸禄入账' }]
      : []),
    { id: 'leave', label: '弟子告退', tone: 'muted' as const },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={options}
      busy={session.phase === 'loading' || session.phase === 'submitting'}
      error={session.error ?? current.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'claim') void session.dispatch('claim');
      }}
    />
  );
}
