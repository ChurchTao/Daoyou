import { CultivatorAttributeTable } from '@app/components/feature/cultivator-inspection/CultivatorAttributeTable';
import { CultivatorLoadoutSections } from '@app/components/feature/cultivator-inspection/CultivatorLoadoutSections';
import { GameLoadingState, GameSceneTabs } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import {
  PARTY_APPLICATION_LIMIT,
  PARTY_CAPACITY,
  type IncomingPartyApplication,
  type PartyApplicantBuild,
  type PartyApplication,
  type PartyCommand,
  type PartyPublicMember,
  type PartyRecruitment,
  type PartyView,
} from '@daoyou/contracts/party';
import { useEffect, useRef, useState } from 'react';
import { PartyChat } from './PartyChat';
import { partyInviteHref, requestParty } from './partyWorkspaceApi';
import { useParty } from './useParty';

const applicationStatus: Record<PartyApplication['status'], string> = {
  pending: '待队长审核',
  accepted: '已通过',
  rejected: '未通过',
  cancelled: '已撤回',
  expired: '已失效',
};
const expiresTime = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Shanghai',
});

function PartyIdentity({
  member,
  children,
}: {
  member: PartyPublicMember;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <GameIcon
        purpose="artwork"
        value={
          member.gender === '女'
            ? 'icon:cultivator-female-avatar'
            : 'icon:cultivator-male-avatar'
        }
        className="border-ink-border bg-paper-2 size-11 shrink-0 rounded-full border"
      />
      <div className="min-w-0 wrap-anywhere">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <strong>{member.name}</strong>
          {children}
        </div>
        <p className="text-ink-secondary text-xs leading-5">
          {member.realm}
          {member.realmStage}
          {member.title && ` · ${member.title}`}
        </p>
      </div>
    </div>
  );
}

function ApplicationReview({
  application,
  full,
  onReview,
}: {
  application: IncomingPartyApplication;
  full: boolean;
  onReview: (command: PartyCommand) => void;
}) {
  const { busy } = useParty();
  const [profile, setProfile] = useState<PartyApplicantBuild>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inspection = useRef<HTMLDivElement>(null);
  const toggleInspection = async () => {
    if (profile) {
      setProfile(undefined);
      return;
    }
    setError('');
    setLoading(true);
    try {
      setProfile(
        await requestParty(`/applications/${application.id}/cultivator`),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法查探这位道友');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (profile) inspection.current?.scrollIntoView({ block: 'nearest' });
  }, [profile]);
  return (
    <li className="grid gap-2 py-3">
      <PartyIdentity member={application.applicant} />
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm">
        <p className="text-ink-secondary">{application.label}</p>
        <InkButton
          variant="secondary"
          disabled={loading}
          onClick={() => void toggleInspection()}
        >
          {profile ? '收起构筑' : '查看构筑'}
        </InkButton>
      </div>
      {error && <InkNotice tone="warning">{error}</InkNotice>}
      {profile && (
        <div
          ref={inspection}
          className="border-ink-border space-y-3 border-y py-3"
        >
          {profile.combatPanel && (
            <CultivatorAttributeTable
              cultivator={{ ...profile, combatPanel: profile.combatPanel }}
            />
          )}
          <CultivatorLoadoutSections build={profile.build} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2">
        <InkButton
          variant="primary"
          disabled={busy || full}
          onClick={() =>
            onReview({ type: 'approve', applicationId: application.id })
          }
        >
          同意入队
        </InkButton>
        <InkButton
          variant="secondary"
          disabled={busy}
          onClick={() =>
            onReview({ type: 'reject', applicationId: application.id })
          }
        >
          拒绝
        </InkButton>
      </div>
    </li>
  );
}

function PartyRoster({
  party,
  roleMismatch,
}: {
  party: PartyView;
  roleMismatch: boolean;
}) {
  const { actorId, value, busy, send } = useParty();
  const [management, setManagement] = useState(false);
  const [review, setReview] = useState(false);
  const [confirm, setConfirm] = useState<PartyCommand>();
  const confirmation = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  const captain =
    !roleMismatch &&
    party.members.some(
      (member) =>
        member.userId === party.leaderId && member.cultivatorId === actorId,
    );
  const full = party.members.length >= PARTY_CAPACITY;
  const incoming = value?.incoming ?? [];
  const target =
    confirm && 'userId' in confirm
      ? party.members.find(({ userId }) => userId === confirm.userId)
      : undefined;
  useEffect(() => {
    if (confirm) confirmation.current?.scrollIntoView({ block: 'nearest' });
  }, [confirm]);

  async function act(command: PartyCommand) {
    setNote('');
    const result = await send(command);
    if (!result) return;
    setConfirm(undefined);
    if (result.outcome === 'accepted') setNote('已同意入队');
    if (result.outcome === 'rejected') setNote('已拒绝申请');
    if (result.outcome === 'expired')
      setNote('申请已失效，请以当前招募和名单为准');
    if (result.outcome === 'cancelled') setNote('申请已由道友撤回');
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(
        new URL(partyInviteHref(party.id), window.location.origin).href,
      );
      setNote('申请链接已复制');
    } catch {
      setNote('暂时无法复制申请链接，请重试。');
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <h3 className="text-lg font-semibold">队伍成员</h3>
        <span className="text-ink-secondary text-sm">
          <b className="font-mono">
            {party.members.length}/{PARTY_CAPACITY}
          </b>{' '}
          人
        </span>
      </div>
      {roleMismatch && (
        <InkNotice tone="warning">
          本账号的另一位角色正在队中。切回该角色即可管理队伍和查看传音。
        </InkNotice>
      )}
      {captain && incoming.length > 0 && (
        <section
          aria-label="入队申请"
          className="border-crimson/35 bg-crimson/5 border-s-2 px-3 py-1"
        >
          <div className="flex flex-wrap items-center justify-between">
            <strong>
              入队申请 <span className="font-mono">{incoming.length}</span>
            </strong>
            <InkButton
              variant={review ? 'secondary' : 'primary'}
              onClick={() => setReview(!review)}
            >
              {review ? '收起申请' : '处理申请'}
            </InkButton>
          </div>
          {review && (
            <>
              {full && (
                <p className="text-ink-secondary text-sm">
                  队伍已满，空出席位后可以同意申请。
                </p>
              )}
              <ul className="divide-ink-border divide-y">
                {incoming.map((application) => (
                  <ApplicationReview
                    key={application.id}
                    application={application}
                    full={full}
                    onReview={(command) => void act(command)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {note && (
        <p className="text-ink-secondary text-sm" role="status">
          {note}
        </p>
      )}
      <ul className="divide-ink-border border-ink-border divide-y border-y">
        {party.members.map((member) => (
          <li key={member.cultivatorId} className="grid gap-1.5 py-3">
            <PartyIdentity member={member}>
              {member.userId === party.leaderId && (
                <small className="text-wood">队长</small>
              )}
              {member.cultivatorId === actorId && (
                <small className="text-teal">我</small>
              )}
            </PartyIdentity>
            {management && captain && member.userId !== party.leaderId && (
              <div className="flex flex-wrap gap-x-2 pl-12">
                <InkButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      type: 'promote',
                      partyId: party.id,
                      userId: member.userId,
                    })
                  }
                >
                  移交队长
                </InkButton>
                <InkButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      type: 'kick',
                      partyId: party.id,
                      userId: member.userId,
                    })
                  }
                >
                  请离
                </InkButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-2">
        {!roleMismatch && !full && (
          <InkButton onClick={() => void share()}>复制申请链接</InkButton>
        )}
        <InkButton
          variant="secondary"
          onClick={() => setManagement(!management)}
        >
          {management ? '收起管理' : '队伍管理'}
        </InkButton>
      </div>
      {management && (
        <div className="flex flex-wrap gap-x-2">
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirm({ type: 'leave', partyId: party.id })}
          >
            退出队伍
          </InkButton>
          {captain && party.members.length > 1 && (
            <InkButton
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm({ type: 'disband', partyId: party.id })}
            >
              解散队伍
            </InkButton>
          )}
        </div>
      )}
      {confirm && (
        <div
          className="border-crimson/40 bg-crimson/5 border-s-2 p-3"
          role="group"
          aria-label="确认队伍操作"
          ref={confirmation}
        >
          <p className="text-sm leading-6">
            {confirm.type === 'disband' ? (
              '队员将离队，分享链接和待审申请失效。'
            ) : confirm.type === 'promote' ? (
              `「${target?.name ?? '该队员'}」将接任队长，负责入队审批和队伍管理。`
            ) : (
              <>
                {target && `「${target.name}」将离队。`}
                候场需要重新准备。连战会在当前波结算后回到集结。
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <InkButton
              variant="primary"
              disabled={busy}
              onClick={() => void act(confirm)}
            >
              确认
              {confirm.type === 'disband'
                ? '解散'
                : confirm.type === 'promote'
                  ? '移交'
                  : confirm.type === 'kick'
                    ? '请离'
                    : '退出'}
            </InkButton>
            <InkButton
              variant="secondary"
              onClick={() => setConfirm(undefined)}
            >
              取消
            </InkButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Recruitment({
  entry,
  atLimit,
}: {
  entry: PartyRecruitment;
  atLimit: boolean;
}) {
  const { value, busy, send } = useParty();
  const active = value?.outgoing.find(
    (request) =>
      request.status === 'pending' && request.partyId === entry.partyId,
  );
  return (
    <div className="grid gap-2 py-3">
      <PartyIdentity member={entry.leader}>
        <small className="text-wood">队长</small>
      </PartyIdentity>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <div className="text-sm">
          <strong>{entry.label}</strong>
          <span className="text-ink-secondary">
            {' '}
            ·{' '}
            <b className="font-mono">
              {entry.memberCount}/{PARTY_CAPACITY}
            </b>{' '}
            人
          </span>
          {entry.requirement && (
            <p className="text-ink-secondary text-xs">
              招募境界 {entry.requirement}
            </p>
          )}
        </div>
        {active ? (
          <span className="text-teal text-sm">待队长审核</span>
        ) : entry.memberCount >= PARTY_CAPACITY ? (
          <span className="text-ink-secondary text-sm">队伍已满</span>
        ) : (
          <InkButton
            variant="primary"
            disabled={busy || atLimit}
            onClick={() =>
              void send({
                type: 'apply',
                partyId: entry.partyId,
                source: entry.source,
              })
            }
          >
            申请入队
          </InkButton>
        )}
      </div>
    </div>
  );
}

function PartyDiscovery({ invite }: { invite?: string }) {
  const { busy, send, value } = useParty();
  const [kind, setKind] = useState<'hunt' | 'invasion'>('hunt');
  const [view, setView] = useState<'find' | 'applications'>('find');
  const [load, setLoad] = useState<{
    path: string;
    items?: PartyRecruitment[];
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const path = invite ?? `/recruitments?kind=${kind}`;
  useEffect(() => {
    if (view !== 'find' && !invite) return;
    const abort = new AbortController();
    void (
      invite
        ? requestParty<PartyRecruitment>(path, { signal: abort.signal }).then(
            (entry) => [entry],
          )
        : requestParty<{ items: PartyRecruitment[] }>(path, {
            signal: abort.signal,
          }).then(({ items }) => items)
    )
      .then((items) => {
        if (!abort.signal.aborted) setLoad({ path, items });
      })
      .catch((cause: Error) => {
        if (!abort.signal.aborted) setLoad({ path, error: cause.message });
      });
    return () => abort.abort();
  }, [path, invite, retry, view]);
  const current = load?.path === path ? load : undefined;
  const outgoing = value?.outgoing ?? [];
  const pending = outgoing.filter((row) => row.status === 'pending').length;
  const finding = invite || view === 'find';
  return (
    <div className="grid gap-3">
      {invite ? (
        <InkButton variant="secondary" href="/game/party">
          返回组队
        </InkButton>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <h3 className="text-lg font-semibold">寻觅同行道友</h3>
            <InkButton
              variant="primary"
              disabled={busy}
              onClick={() => void send({ type: 'create' })}
            >
              组建队伍
            </InkButton>
          </div>
          <GameSceneTabs
            className="[&_button]:min-h-11"
            activeValue={view}
            items={[
              { value: 'find', label: '找队伍' },
              {
                value: 'applications',
                label: pending ? `我的申请 (${pending})` : '我的申请',
              },
            ]}
            onChange={(next) =>
              setView(next === 'applications' ? 'applications' : 'find')
            }
          />
        </>
      )}
      {finding ? (
        <>
          {!invite && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label
                className="text-ink-secondary"
                htmlFor="party-recruitment-activity"
              >
                玩法
              </label>
              <select
                className="bg-paper border-ink-border min-h-11 border px-2"
                id="party-recruitment-activity"
                value={kind}
                onChange={(event) =>
                  setKind(
                    event.target.value === 'invasion' ? 'invasion' : 'hunt',
                  )
                }
              >
                <option value="hunt">结伴讨伐</option>
                <option value="invasion">古魔入侵</option>
              </select>
              <InkButton
                variant="secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                刷新招募
              </InkButton>
            </div>
          )}
          {current?.error ? (
            <InkNotice tone="warning">{current.error}</InkNotice>
          ) : !current ? (
            <GameLoadingState variant="inline" message="正在查看招募……" />
          ) : current.items?.length ? (
            <ul className="divide-ink-border border-ink-border divide-y border-y">
              {current.items.map((entry) => (
                <li key={entry.partyId}>
                  <Recruitment
                    entry={entry}
                    atLimit={pending >= PARTY_APPLICATION_LIMIT}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-secondary py-3 text-sm">
              当前没有符合条件的招募。
            </p>
          )}
          {invite && pending > 0 && (
            <p className="text-ink-secondary text-sm">
              可在「组队 → 我的申请」撤回。
            </p>
          )}
          {pending >= PARTY_APPLICATION_LIMIT && (
            <p className="text-ink-secondary text-sm">
              待审核申请已满。可在「我的申请」撤回一条，再发出新申请。
            </p>
          )}
        </>
      ) : outgoing.length ? (
        <ul className="divide-ink-border border-ink-border divide-y border-y">
          {outgoing.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-1 py-3 text-sm"
            >
              <div>
                <strong>{row.partyLabel}的队伍</strong>
                <p className="text-ink-secondary">
                  {row.label} · {applicationStatus[row.status]}
                  {row.status === 'pending' && (
                    <>
                      {' '}
                      ·{' '}
                      <span className="font-mono">
                        {expiresTime.format(row.expiresAt)}
                      </span>{' '}
                      前有效
                    </>
                  )}
                </p>
              </div>
              {row.status === 'pending' && (
                <InkButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void send({ type: 'cancel', applicationId: row.id })
                  }
                >
                  撤回
                </InkButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-secondary py-3 text-sm">暂无入队申请。</p>
      )}
    </div>
  );
}

function PartyConversation({ party }: { party: PartyView }) {
  const { actorId, draft, setDraft, setChatVisible } = useParty();
  useEffect(() => {
    setChatVisible(true);
    return () => setChatVisible(false);
  }, [setChatVisible]);
  return (
    <PartyChat
      team={party}
      actorId={actorId}
      draft={draft?.text ?? ''}
      reply={draft?.reply ?? null}
      setDraft={(update) =>
        setDraft((old) => ({
          ...old,
          text: typeof update === 'function' ? update(old.text) : update,
        }))
      }
      setReply={(update) =>
        setDraft((old) => ({
          ...old,
          reply: typeof update === 'function' ? update(old.reply) : update,
        }))
      }
    />
  );
}

export function PartyWorkspace({
  initialTab = 'party',
  invite,
  compact = false,
}: {
  initialTab?: 'party' | 'chat';
  invite?: string;
  compact?: boolean;
}) {
  const { value, error, unread, refresh } = useParty();
  const [tab, setTab] = useState(initialTab);
  const party = value?.party;
  const chat = !!party && !value?.roleMismatch && tab === 'chat';
  if (!value)
    return error ? (
      <InkNotice tone="warning">
        {error}{' '}
        <InkButton variant="secondary" onClick={refresh}>
          重试
        </InkButton>
      </InkNotice>
    ) : (
      <GameLoadingState variant="inline" message="正在读取队伍……" />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {party && !value.roleMismatch && (
        <GameSceneTabs
          className="[&_button]:min-h-11"
          activeValue={tab}
          items={[
            { value: 'party', label: '队伍' },
            {
              value: 'chat',
              label: unread ? `传音 (${unread > 99 ? '99+' : unread})` : '传音',
            },
          ]}
          onChange={(next) => setTab(next === 'chat' ? 'chat' : 'party')}
        />
      )}
      {error && <InkNotice tone="warning">{error}</InkNotice>}
      {chat && party ? (
        <div
          className={
            compact
              ? 'flex min-h-0 flex-1 flex-col'
              : 'flex h-[min(35rem,57dvh)] min-h-48 flex-col'
          }
        >
          <PartyConversation key={party.id} party={party} />
        </div>
      ) : (
        <div
          className={
            compact ? 'battle-scroll min-h-0 flex-1 overflow-y-auto' : ''
          }
        >
          {party ? (
            <PartyRoster
              key={party.id}
              party={party}
              roleMismatch={value.roleMismatch}
            />
          ) : (
            <PartyDiscovery invite={invite} />
          )}
        </div>
      )}
    </div>
  );
}
