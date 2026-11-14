import {
  socialRequest,
  useSocialQuery,
} from '@app/components/feature/friends/socialApi';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice, InkTabs } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { apiFetch } from '@app/lib/api/fetch';
import { useAuth } from '@app/lib/auth/useAuth';
import { pendingCommandRequest } from '@app/lib/pendingCommandRequest';
import { usePlayerSession } from '@app/lib/resources/player';
import { REALM_VALUES } from '@daoyou/constants/realms';
import type { FriendTargetResponse } from '@daoyou/contracts/friends';
import type {
  MentorshipMentorView,
  MentorshipOverview,
  MentorshipRelationView,
  MentorshipRequestView,
} from '@daoyou/contracts/mentorship';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CurrentMentorship } from './components/CurrentMentorship';
import { GraduationProgress } from './components/GraduationProgress';
import { MentorDirectory } from './components/MentorDirectory';
import {
  MentorshipRecords,
  MentorshipRequests,
} from './components/MentorshipRegisters';
import { RecruitmentEditor } from './components/RecruitmentEditor';

const tabs = [
  { value: 'current', label: '师门' },
  { value: 'mentors', label: '寻师' },
  { value: 'requests', label: '结缘' },
  { value: 'records', label: '桃李簿' },
];
type Intent =
  | {
      kind: 'request';
      targetId: string;
      name: string;
      direction: 'apprentice' | 'mentor';
    }
  | { kind: 'accept'; request: MentorshipRequestView }
  | { kind: 'dissolve' | 'graduate'; relation: MentorshipRelationView };
type Panel =
  | { kind: 'rules' | 'profile' }
  | { kind: 'mentor'; mentor: MentorshipMentorView }
  | { kind: 'relation'; relation: MentorshipRelationView };
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN');

function Rules() {
  return (
    <div className="space-y-7 text-sm leading-7">
      <section className="space-y-2">
        <h3 className="font-semibold">结一段师缘</h3>
        <p>
          化神及以上可收徒，元婴以前可拜师；可跨宗门结缘，同时最多有两名在授弟子。
        </p>
        <p className="text-crimson">
          弟子账号一生只认一位师父。拜师礼成后，解除、死亡或转世均不能再次拜师，包括原师父。
        </p>
        <p className="text-ink-secondary">
          发出申请不会立即绑定。双方接受后，建立师徒及好友关系；日常交流使用好友私聊。
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">四项皆成，自主出师</h3>
        <ul className="space-y-2">
          <li>境界达到元婴后期。</li>
          <li>一门元婴期功法修至六层。</li>
          <li>当前宗门三门心法各达六十级。</li>
          <li>炼体至少两轨各达二十级。</li>
        </ul>
        <p className="text-ink-secondary">
          修行由本人完成，出师无须师父确认。师父离线或私聊暂停时，仍可继续修行和出师。
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">桃李留名</h3>
        <p>
          出师时徒弟获得<span className="text-teal font-mono"> 100 </span>
          声望，师父获得<span className="text-teal font-mono"> 300 </span>
          声望，并向世界公布喜讯。奖励仅结算一次，师父的在授名额随之释放。
        </p>
        <p className="text-ink-secondary">
          拜师与桃李成就按角色独立记录，可在名片中选择展示。解除师徒关系不扣资源，也不移除好友。
        </p>
      </section>
    </div>
  );
}

export default function MentorshipPage() {
  const { user } = useAuth();
  const actorId = usePlayerSession().data?.activeCultivator?.id;
  return <MentorshipWorkspace key={(user?.id ?? '') + ':' + (actorId ?? '')} />;
}

function MentorshipWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((item) => item.value === params.get('tab'))
    ? params.get('tab')!
    : 'current';
  const overview = useSocialQuery<MentorshipOverview>('/api/mentorship');
  const mentors = useSocialQuery<{ mentors: MentorshipMentorView[] }>(
    tab === 'mentors' ? '/api/mentorship/mentors' : null,
  );
  const targetId = params.get('target');
  const target = useSocialQuery<FriendTargetResponse>(
    targetId ? '/api/friends/invite/' + encodeURIComponent(targetId) : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [actionError, setActionError] = useState('');
  const [failedContact, setFailedContact] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { pushToast } = useInkUI();
  const navigate = useNavigate();
  const data = overview.data;
  const pending =
    data?.requests.filter(
      (request) =>
        request.status === 'pending' &&
        (request.mentor.id === data.actor.id ||
          request.disciple.id === data.actor.id),
    ) ?? [];
  const incoming = pending.filter((request) => request.incoming);
  const selectedMentor =
    panel?.kind === 'mentor'
      ? (mentors.data?.mentors.find(
          (mentor) => mentor.cultivatorId === panel.mentor.cultivatorId,
        ) ?? panel.mentor)
      : null;
  const selectedRelation =
    panel?.kind === 'relation'
      ? (data?.relations.find(
          (relation) => relation.id === panel.relation.id,
        ) ?? panel.relation)
      : null;
  const mentorStillOpen =
    !!selectedMentor &&
    !!mentors.data?.mentors.some(
      (mentor) => mentor.cultivatorId === selectedMentor.cultivatorId,
    );
  const selectedRequest = selectedMentor
    ? pending.find(
        (request) => request.mentor.id === selectedMentor.cultivatorId,
      )
    : null;
  const blockReason = data?.eligibility.permanentlyBound
    ? '此账号已结过师缘，不能再次拜师。'
    : data?.eligibility.reasons.join('；') || '元婴以前的角色可申请拜师。';

  function chooseTab(value: string, clearTarget = false) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', value);
      if (clearTarget) next.delete('target');
      return next;
    });
  }
  function openPanel(next: Panel) {
    setActionError('');
    setFailedContact(null);
    setPanel(next);
  }
  function openIntent(next: Intent) {
    setActionError('');
    setFailedContact(null);
    setIntent(next);
  }
  function removeTarget() {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('target');
        return next;
      },
      { replace: true },
    );
  }
  function closePanel() {
    if (busy) return;
    setActionError('');
    if (intent) {
      setIntent(null);
      return;
    }
    setPanel(null);
    if (targetId) removeTarget();
  }
  function goToRequests() {
    setPanel(null);
    chooseTab('requests', true);
  }

  async function mutation(
    key: string,
    path: string,
    body: Record<string, unknown>,
    method = 'POST',
  ) {
    if (!data?.actor.id || busy) return false;
    setBusy(key);
    setActionError('');
    setFailedContact(null);
    const attempt = pendingCommandRequest(data.actor.id, key, body);
    try {
      await socialRequest(
        path,
        { ...body, requestId: attempt.requestId },
        method,
      );
      attempt.complete();
      setIntent(null);
      if (key === 'profile') setPanel(null);
      if (key.startsWith('request:')) {
        setPanel(null);
        chooseTab('requests', true);
      }
      if (key.startsWith('accept:') || key.startsWith('graduate:')) {
        setPanel(null);
        chooseTab('current', true);
      }
      await overview.reload();
      pushToast({
        message: key.startsWith('graduate:')
          ? '出师已成，声望已发放'
          : key.startsWith('request:')
            ? '申请已送达，等待对方回应'
            : key === 'profile'
              ? '招募资料已保存'
              : '师徒记录已更新',
        tone: 'success',
      });
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : '操作未完成，请重试',
      );
      await overview.reload();
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function chat(id: string) {
    if (busy) return;
    setBusy('chat:' + id);
    setActionError('');
    setFailedContact(null);
    try {
      const result = await socialRequest<{ conversation: { id: string } }>(
        '/api/direct-messages/conversations',
        { cultivatorId: id },
      );
      navigate('/game/friends?chat=' + result.conversation.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '当前无法私聊');
      setFailedContact(id);
    } finally {
      setBusy(null);
    }
  }
  function confirmIntent() {
    if (!intent) return;
    if (intent.kind === 'request')
      void mutation(
        'request:' + intent.targetId + ':' + intent.direction,
        '/api/mentorship/requests',
        { targetCultivatorId: intent.targetId, direction: intent.direction },
      );
    else if (intent.kind === 'accept')
      void mutation(
        'accept:' + intent.request.id,
        '/api/mentorship/requests/' + intent.request.id + '/accept',
        { expectedRevision: intent.request.revision },
      );
    else
      void mutation(
        intent.kind + ':' + intent.relation.id,
        '/api/mentorship/relations/' + intent.relation.id + '/' + intent.kind,
        { expectedRevision: intent.relation.revision },
      );
  }
  const targetRank = target.data
    ? REALM_VALUES.indexOf(
        target.data.target.realm as (typeof REALM_VALUES)[number],
      )
    : -1;
  const targetRequest = targetId
    ? pending.find(
        (request) =>
          request.mentor.id === targetId || request.disciple.id === targetId,
      )
    : null;
  const ownDisciples =
    data?.relations.filter(
      (relation) =>
        relation.status === 'active' && relation.mentor.id === data.actor.id,
    ).length ?? 0;
  const canRequestTarget =
    !!data &&
    target.data?.relationship !== 'unavailable' &&
    targetId !== data.actor.id &&
    !targetRequest &&
    ((data.eligibility.canApprentice &&
      targetRank >= REALM_VALUES.indexOf('化神')) ||
      (data.eligibility.canMentor &&
        ownDisciples < 2 &&
        targetRank >= 0 &&
        targetRank < REALM_VALUES.indexOf('元婴')));
  const drawerTitle = intent
    ? intent.kind === 'graduate'
      ? '出师礼'
      : intent.kind === 'dissolve'
        ? '解除师徒关系'
        : intent.kind === 'accept'
          ? '行拜师礼'
          : '递交拜帖'
    : panel?.kind === 'rules'
      ? '师承须知'
      : panel?.kind === 'profile'
        ? '收徒招募'
        : selectedMentor
          ? '师父资料'
          : selectedRelation
            ? selectedRelation.role === 'mentor'
              ? '弟子进境'
              : '师承详情'
            : '师徒结缘';
  const drawerOpen = !!intent || !!panel || !!targetId;
  const intentText =
    intent?.kind === 'request'
      ? intent.direction === 'apprentice'
        ? '拜 ' + intent.name + ' 为师'
        : '邀 ' + intent.name + ' 入门'
      : intent?.kind === 'accept'
        ? intent.request.disciple.name +
          ' 拜 ' +
          intent.request.mentor.name +
          ' 为师'
        : intent?.kind === 'graduate'
          ? intent.relation.disciple.name +
            ' 从 ' +
            intent.relation.mentor.name +
            ' 门下出师'
          : intent
            ? '解除与 ' +
              (intent.relation.role === 'mentor'
                ? intent.relation.disciple.name
                : intent.relation.mentor.name) +
              ' 的在授关系'
            : '';

  return (
    <GameSceneFrame description="一脉师承，各自成道。">
      <div className="flex items-center gap-2">
        <InkTabs
          className="min-w-0 flex-1 [&_button]:min-h-11 [&>div]:gap-1"
          items={tabs.map((item) =>
            item.value === 'requests' && incoming.length
              ? {
                  ...item,
                  label: (
                    <>
                      结缘 <span className="font-mono">{incoming.length}</span>
                    </>
                  ),
                }
              : item,
          )}
          activeValue={tab}
          onChange={chooseTab}
        />
        <InkButton
          className="min-h-11 shrink-0"
          variant="secondary"
          onClick={() => openPanel({ kind: 'rules' })}
        >
          须知
        </InkButton>
      </div>
      {overview.loading && !data ? (
        <GameLoadingState message="正在翻阅师承名录……" variant="inline" />
      ) : null}
      {overview.error ? (
        <div role="alert" className="space-y-2">
          <InkNotice tone="warning">{overview.error}</InkNotice>
          <InkButton onClick={() => void overview.reload()}>
            重新读取师承
          </InkButton>
        </div>
      ) : null}
      {actionError && !drawerOpen ? (
        <div
          role="alert"
          className="text-crimson border-crimson/25 border-l-2 pl-3 text-sm leading-7"
        >
          {actionError}
          {failedContact ? (
            <div>
              <InkButton
                className="min-h-11"
                href={'/game/friends?addFriend=' + failedContact}
              >
                查看好友关系
              </InkButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {data ? (
        tab === 'current' ? (
          <CurrentMentorship
            data={data}
            busy={busy}
            onChat={(id) => void chat(id)}
            onRelation={(relation) => openPanel({ kind: 'relation', relation })}
            onGraduate={(relation) =>
              openIntent({ kind: 'graduate', relation })
            }
            onRecruit={() => openPanel({ kind: 'profile' })}
            onTab={chooseTab}
          />
        ) : tab === 'mentors' ? (
          <MentorDirectory
            mentors={mentors.data?.mentors}
            loading={mentors.loading}
            error={mentors.error}
            canApprentice={data.eligibility.canApprentice}
            blockReason={blockReason}
            pendingRequests={pending}
            search={search}
            onSearch={setSearch}
            onSelect={(mentor) => openPanel({ kind: 'mentor', mentor })}
            onRequests={goToRequests}
            onRetry={() => void mentors.reload()}
          />
        ) : tab === 'requests' ? (
          <MentorshipRequests
            data={data}
            busy={busy}
            onAccept={(request) => openIntent({ kind: 'accept', request })}
            onRespond={(request, action) =>
              void mutation(
                action + ':' + request.id,
                '/api/mentorship/requests/' + request.id + '/' + action,
                { expectedRevision: request.revision },
              )
            }
          />
        ) : (
          <MentorshipRecords
            data={data}
            busy={busy}
            onChat={(id) => void chat(id)}
          />
        )
      ) : null}
      <InkDetailDrawer
        className="[&>header_button]:min-h-11"
        isOpen={drawerOpen}
        title={drawerTitle}
        size={panel?.kind === 'rules' ? 'md' : 'sm'}
        onClose={closePanel}
        closeOnEscape={!busy}
        closeOnOverlayClick={!busy}
        closeLabel={intent && (panel || targetId) ? '返回' : '收起'}
        footer={
          intent ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <InkButton
                className="min-h-11"
                variant="secondary"
                disabled={!!busy}
                onClick={closePanel}
              >
                {panel || targetId ? '返回资料' : '取消'}
              </InkButton>
              <InkButton
                className="min-h-11"
                variant="primary"
                pending={!!busy}
                pendingLabel="正在落定……"
                onClick={confirmIntent}
              >
                {intent.kind === 'graduate'
                  ? '确认出师'
                  : intent.kind === 'dissolve'
                    ? '确认解除'
                    : intent.kind === 'accept'
                      ? '接受师承'
                      : '发出申请'}
              </InkButton>
            </div>
          ) : selectedMentor ? (
            <div className="space-y-2">
              {selectedRequest ? (
                <>
                  <p className="text-ink-secondary text-sm">
                    {selectedRequest.incoming
                      ? '对方已递来拜帖，等待你回应。'
                      : '拜帖已送达，等待对方回应。'}
                  </p>
                  <InkButton className="min-h-11" onClick={goToRequests}>
                    查看结缘申请
                  </InkButton>
                </>
              ) : (
                <>
                  <p
                    className={
                      data?.eligibility.canApprentice
                        ? 'text-crimson text-sm leading-6'
                        : 'text-ink-secondary text-sm leading-6'
                    }
                  >
                    {data?.eligibility.canApprentice
                      ? mentorStillOpen
                        ? '拜师礼成后，账号永久绑定这位师父。'
                        : '这位道友已不在当前开放名录中，可收起资料后重新寻访。'
                      : blockReason}
                  </p>
                  <InkButton
                    className="min-h-11"
                    variant="primary"
                    disabled={
                      !!busy ||
                      !data?.eligibility.canApprentice ||
                      !mentorStillOpen ||
                      !selectedMentor.remainingSeats
                    }
                    onClick={() =>
                      openIntent({
                        kind: 'request',
                        targetId: selectedMentor.cultivatorId,
                        name: selectedMentor.name,
                        direction: 'apprentice',
                      })
                    }
                  >
                    {!mentorStillOpen
                      ? '当前未开放收徒'
                      : selectedMentor.remainingSeats
                        ? '申请拜师'
                        : '在授名额已满'}
                  </InkButton>
                </>
              )}
            </div>
          ) : !panel && target.data && data && !intent ? (
            <div className="flex flex-wrap justify-end gap-2">
              {targetRequest ? (
                <InkButton onClick={goToRequests}>查看结缘申请</InkButton>
              ) : canRequestTarget ? (
                <InkButton
                  className="min-h-11"
                  variant="primary"
                  onClick={() =>
                    openIntent({
                      kind: 'request',
                      targetId: target.data!.target.id,
                      name: target.data!.target.name,
                      direction:
                        data.eligibility.canMentor &&
                        targetRank < REALM_VALUES.indexOf('元婴')
                          ? 'mentor'
                          : 'apprentice',
                    })
                  }
                >
                  {data.eligibility.canMentor &&
                  targetRank < REALM_VALUES.indexOf('元婴')
                    ? '邀请收徒'
                    : '申请拜师'}
                </InkButton>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {intent ? (
          <div className="space-y-6">
            <p className="text-ink-secondary text-xs tracking-widest">
              {intent.kind === 'graduate'
                ? '修行已成 · 桃李留名'
                : intent.kind === 'dissolve'
                  ? '关系变更'
                  : '结一段师缘'}
            </p>
            <h3 className="text-xl leading-8 font-semibold break-words">
              {intentText}
            </h3>
            {intent.kind === 'graduate' ? (
              <>
                <dl className="border-teal/20 grid grid-cols-2 gap-4 border-y py-5">
                  <div>
                    <dt className="text-ink-secondary text-sm">徒弟声望</dt>
                    <dd className="text-teal mt-1 font-mono text-3xl">+100</dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary text-sm">师父声望</dt>
                    <dd className="text-teal mt-1 font-mono text-3xl">+300</dd>
                  </div>
                </dl>
                <p className="text-sm leading-7">
                  出师喜讯将推送至世界系统消息，双方奖励仅发放一次。
                </p>
                <p className="text-ink-secondary text-sm leading-7">
                  无需师父确认。出师后释放在授名额，师徒称谓和好友关系保留；此账号仍不能再次拜师。
                </p>
              </>
            ) : (
              <div className="border-crimson/25 space-y-3 border-l-2 pl-4 text-sm leading-7">
                <p className="text-crimson">
                  {intent.kind === 'dissolve'
                    ? '解除后仍保留账号的一生一师绑定，无法再次拜师，包括原师父。'
                    : '弟子账号一生只认这位师父。礼成后，解除、死亡或转世均无法再次拜师，包括原师父。'}
                </p>
                <p className="text-ink-secondary">
                  {intent.kind === 'dissolve'
                    ? '不扣除资源，个人修行与双方好友关系保留。'
                    : intent.kind === 'request'
                      ? '此次仅发送申请，对方接受后才正式结缘，并同时建立好友关系。'
                      : '确认后正式结缘，并同时建立好友关系。'}
                </p>
              </div>
            )}
          </div>
        ) : panel?.kind === 'rules' ? (
          <Rules />
        ) : panel?.kind === 'profile' && data ? (
          <RecruitmentEditor
            profile={data.profile}
            pending={!!busy}
            error={actionError}
            onSave={(value) =>
              mutation('profile', '/api/mentorship/profile', value, 'PUT')
            }
            onReadLatest={async () => {
              const response = await apiFetch('/api/mentorship');
              if (!response.ok) throw new Error('读取最新招募资料失败，请重试');
              const latest = (await response.json()) as MentorshipOverview;
              return latest.profile;
            }}
            onClose={() => setPanel(null)}
          />
        ) : selectedMentor ? (
          <div className="space-y-6">
            <div>
              <p className="text-ink-secondary mb-2 text-xs tracking-widest">
                {selectedMentor.realm} · {selectedMentor.realmStage}
              </p>
              <h3 className="text-2xl font-semibold break-words">
                {selectedMentor.name}
              </h3>
              <p className="text-ink-secondary mt-2 text-sm">
                {selectedMentor.sectName || '散修'} · 尚余{' '}
                <span className="text-teal font-mono">
                  {selectedMentor.remainingSeats}
                </span>{' '}
                席
              </p>
            </div>
            <dl className="space-y-5 text-sm leading-7">
              <div>
                <dt className="text-ink-secondary mb-1 text-xs">擅长方向</dt>
                <dd>
                  {selectedMentor.profile.directions.join('、') ||
                    '愿与后辈交流修行'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary mb-1 text-xs">常用时段</dt>
                <dd className="break-words">
                  {selectedMentor.profile.availableTimes ||
                    '可结缘后通过私聊约定'}
                </dd>
              </div>
              <div className="border-ink/15 border-t pt-5">
                <dt className="text-ink-secondary mb-2 text-xs">收徒自述</dt>
                <dd className="break-words whitespace-pre-wrap">
                  {selectedMentor.profile.introduction ||
                    '这位道友尚未留下自述。'}
                </dd>
              </div>
            </dl>
          </div>
        ) : selectedRelation && data ? (
          <div className="space-y-6">
            <div>
              <p className="text-ink-secondary mb-2 text-xs">
                {selectedRelation.role === 'mentor' ? '门下弟子' : '我的师父'}
              </p>
              <h3 className="text-xl font-semibold">
                {selectedRelation.role === 'mentor'
                  ? selectedRelation.disciple.name
                  : selectedRelation.mentor.name}
              </h3>
              <p className="text-ink-secondary mt-2 text-sm">
                结缘于 {date(selectedRelation.startedAt)}
              </p>
            </div>
            {selectedRelation.role === 'mentor' ? (
              <GraduationProgress
                progress={selectedRelation.graduation}
                actions={false}
                title="出师进境"
              />
            ) : null}
            {selectedRelation.paused ? (
              <InkNotice>
                {selectedRelation.pauseReason}。个人修行与自主出师照常进行。
              </InkNotice>
            ) : null}
            <section className="border-ink/15 space-y-2 border-t pt-5">
              <h3 className="text-ink-secondary text-xs">关系管理</h3>
              <p className="text-ink-secondary text-sm leading-7">
                解除不扣资源，账号的一生一师绑定仍保留。
              </p>
              {selectedRelation.status === 'active' &&
              (selectedRelation.mentor.id === data.actor.id ||
                selectedRelation.disciple.id === data.actor.id) ? (
                <InkButton
                  className="min-h-11"
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    openIntent({ kind: 'dissolve', relation: selectedRelation })
                  }
                >
                  解除师徒关系
                </InkButton>
              ) : null}
            </section>
          </div>
        ) : targetId ? (
          <>
            {target.loading && !target.data ? (
              <GameLoadingState message="正在查看道友身份……" variant="inline" />
            ) : null}
            {target.error ? (
              <div role="alert">
                <InkNotice tone="warning">{target.error}</InkNotice>
                <InkButton onClick={() => void target.reload()}>重试</InkButton>
              </div>
            ) : null}
            {target.data && data ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-semibold">
                    {target.data.target.name}
                  </h3>
                  <p className="text-ink-secondary mt-2 text-sm">
                    {target.data.target.realm}
                    {target.data.target.realmStage}
                  </p>
                </div>
                <p className="text-crimson text-sm leading-7">
                  拜师礼成后，弟子账号一生只认这一位师父，解除后也无法再次拜师。
                </p>
                {!canRequestTarget && !targetRequest ? (
                  <InkNotice>
                    {target.data.relationship === 'unavailable'
                      ? '当前无法联系这位道友，暂不能结缘。请先检查好友与屏蔽关系。'
                      : targetId === data.actor.id
                        ? '无法与自己结缘。'
                        : data.eligibility.canMentor && ownDisciples >= 2
                          ? '两席在授名额已满，弟子出师后可继续收徒。'
                          : '当前双方不符合新的师徒结缘条件。化神及以上可收徒，徒弟须低于元婴且从未拜师。'}
                  </InkNotice>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
        {actionError && panel?.kind !== 'profile' ? (
          <div
            role="alert"
            className="text-crimson border-crimson/25 mt-5 border-l-2 pl-3 text-sm leading-7"
          >
            {actionError}
            <p className="text-ink-secondary mt-1">
              若记录已更新，可返回重新核对后再操作。
            </p>
          </div>
        ) : null}
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
