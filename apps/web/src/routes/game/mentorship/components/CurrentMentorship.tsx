import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type {
  MentorshipOverview,
  MentorshipRelationView,
  MentorshipRequestView,
} from '@daoyou/contracts/mentorship';
import { MENTORSHIP_CONFIG } from '@daoyou/game-content/mentorship';
import { GraduationProgress } from './GraduationProgress';

interface CurrentMentorshipProps {
  data: MentorshipOverview;
  busy: string | null;
  onChat: (id: string) => void;
  onRelation: (relation: MentorshipRelationView) => void;
  onGraduate: (relation: MentorshipRelationView) => void;
  onRecruit: () => void;
  onTab: (tab: string) => void;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ContactActions({
  relation,
  busy,
  onChat,
}: Pick<CurrentMentorshipProps, 'busy' | 'onChat'> & {
  relation: MentorshipRelationView;
}) {
  const peer = relation.role === 'mentor' ? relation.disciple : relation.mentor;
  const canContact = peer.id && (!peer.status || peer.status === 'active');

  return (
    <div className="min-w-0">
      {canContact ? (
        <InkButton
          variant="primary"
          disabled={!!busy || relation.paused}
          pending={busy === `chat:${peer.id}`}
          pendingLabel="正在接续……"
          onClick={() => onChat(peer.id!)}
          className="min-h-11"
        >
          好友私聊
        </InkButton>
      ) : null}
      {relation.paused ? (
        <div className="text-ink-secondary mt-1 text-sm leading-6">
          <p>{relation.pauseReason || '当前暂无法私聊。'}</p>
          {relation.role === 'disciple' ? (
            <p>个人修行与自主出师照常进行。</p>
          ) : null}
          {canContact ? (
            <InkButton
              href={`/game/friends?addFriend=${peer.id}`}
              variant="secondary"
              className="-ml-1.5 min-h-11"
            >
              查看好友关系
            </InkButton>
          ) : null}
        </div>
      ) : !canContact ? (
        <p className="text-ink-secondary text-sm leading-6">原角色已离去</p>
      ) : null}
    </div>
  );
}

function AwaitingRequest({
  request,
  count,
  onTab,
}: Pick<CurrentMentorshipProps, 'onTab'> & {
  request: MentorshipRequestView;
  count: number;
}) {
  return (
    <section className="border-ink/15 border-l-2 py-2 pl-4">
      <p className="text-ink-secondary text-xs tracking-widest">等待回应</p>
      <h2 className="mt-2 text-lg font-semibold">
        {request.mentor.name} 收 {request.disciple.name} 为徒
      </h2>
      <p className="text-ink-secondary mt-2 text-sm leading-6">
        申请已送达，{dateLabel(request.expiresAt)}前有效。
        {count > 1 ? `另有${count - 1}份申请等待回应。` : ''}
      </p>
      <InkButton
        onClick={() => onTab('requests')}
        className="mt-3 -ml-1.5 min-h-11"
      >
        查看申请
      </InkButton>
    </section>
  );
}

export function CurrentMentorship({
  data,
  busy,
  onChat,
  onRelation,
  onGraduate,
  onRecruit,
  onTab,
}: CurrentMentorshipProps) {
  const actorId = data.actor.id;
  const relations = data.relations.filter(
    (relation) =>
      actorId &&
      (relation.role === 'mentor'
        ? relation.mentor.id === actorId
        : relation.disciple.id === actorId),
  );
  const apprenticeship = relations.find(
    (relation) => relation.status === 'active' && relation.role === 'disciple',
  );
  const disciples = relations.filter(
    (relation) => relation.status === 'active' && relation.role === 'mentor',
  );
  const graduation = relations
    .filter(
      (relation) =>
        relation.status === 'graduated' && relation.role === 'disciple',
    )
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0];
  const requests = data.requests.filter(
    (request) =>
      request.status === 'pending' &&
      actorId &&
      (request.mentor.id === actorId || request.disciple.id === actorId),
  );
  const incoming = requests.filter((request) => request.incoming);
  const outgoing = requests.filter((request) => !request.incoming);
  const teaches = data.eligibility.canMentor || disciples.length > 0;
  const remainingSeats = Math.max(
    0,
    MENTORSHIP_CONFIG.mentorSeats - disciples.length,
  );

  const mentorSection = teaches ? (
    <section
      aria-label="门下弟子"
      className={apprenticeship ? 'border-ink/15 border-t pt-6' : undefined}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">门下弟子</h2>
        <p className="text-ink-secondary text-sm">
          在授{' '}
          <span className="text-ink font-mono font-semibold tracking-tight">
            {disciples.length} / {MENTORSHIP_CONFIG.mentorSeats}
          </span>{' '}
          席
        </p>
      </header>

      {disciples.length ? (
        <ul className="divide-ink/10 mt-3 divide-y">
          {disciples.map((relation) => {
            const completed = relation.graduation.milestones.filter(
              (item) => item.complete,
            ).length;
            return (
              <li key={relation.id} className="py-5 first:pt-2">
                <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-lg font-semibold break-words">
                        {relation.disciple.name}
                      </h3>
                      <span className="text-ink-secondary text-sm">
                        {relation.disciple.realm}
                        {relation.disciple.realmStage}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-sm',
                        relation.graduation.ready
                          ? 'text-teal'
                          : 'text-ink-secondary',
                      )}
                    >
                      {relation.graduation.ready ? (
                        '四项皆成，待弟子自主出师'
                      ) : (
                        <>
                          出师进境{' '}
                          <span className="font-mono">
                            {completed} /{' '}
                            {relation.graduation.milestones.length}
                          </span>
                        </>
                      )}
                    </p>
                    <div
                      className="mt-2.5 flex max-w-48 gap-1.5"
                      aria-hidden="true"
                    >
                      {relation.graduation.milestones.map((item) => (
                        <div
                          key={item.key}
                          className={cn(
                            'h-0.5 flex-1',
                            item.complete ? 'bg-teal/70' : 'bg-ink/10',
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-1 gap-y-2">
                    <InkButton
                      onClick={() => onRelation(relation)}
                      disabled={!!busy}
                      className="min-h-11"
                    >
                      查看进境
                    </InkButton>
                  </div>
                </div>
                <div className="mt-2">
                  <ContactActions
                    relation={relation}
                    busy={busy}
                    onChat={onChat}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-8 sm:py-10">
          <p className="text-ink-secondary text-sm leading-7">
            {data.profile?.open
              ? '收徒招募已公开，静候后辈来访。'
              : data.profile
                ? '还没有在授弟子。开放招募后，后辈可以在寻师名录中找到你。'
                : '还没有在授弟子。填写收徒自述，让后辈了解你的修行方向。'}
          </p>
        </div>
      )}

      {data.eligibility.canMentor ? (
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3">
          <div className="min-w-0 py-1">
            <p className="text-sm">
              <span
                className={
                  data.profile?.open ? 'text-teal' : 'text-ink-secondary'
                }
              >
                {data.profile?.open
                  ? '公开收徒中'
                  : data.profile
                    ? '招募已关闭'
                    : '尚未开放招募'}
              </span>
              <span className="text-ink-secondary ml-3">
                {remainingSeats ? (
                  <>
                    余 <span className="font-mono">{remainingSeats}</span> 席
                  </>
                ) : (
                  '在授名额已满'
                )}
              </span>
            </p>
            {data.profile?.directions.length ? (
              <p className="text-ink-secondary mt-1 text-xs leading-6 break-words">
                {data.profile.directions.join(' · ')}
              </p>
            ) : null}
          </div>
          <InkButton
            onClick={onRecruit}
            disabled={!!busy}
            variant={disciples.length ? 'secondary' : 'primary'}
            className="min-h-11"
          >
            {data.profile ? '招募设置' : '填写收徒自述'}
          </InkButton>
        </div>
      ) : (
        <p className="text-ink-secondary text-sm leading-6">
          达到化神期后可继续招收新弟子。
        </p>
      )}
    </section>
  ) : null;

  return (
    <div className="space-y-8 pt-2">
      {incoming.length ? (
        <div className="border-crimson/35 bg-crimson/4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-l-2 py-2 pr-3 pl-4">
          <p className="text-sm">
            有 <span className="text-crimson font-mono">{incoming.length}</span>{' '}
            份结缘申请等待你回应
          </p>
          <InkButton
            variant="primary"
            onClick={() => onTab('requests')}
            className="min-h-11"
          >
            处理申请
          </InkButton>
        </div>
      ) : null}

      {!apprenticeship ? mentorSection : null}

      {apprenticeship ? (
        <section>
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="text-ink-secondary text-xs tracking-widest">
                我的师父
              </p>
              <h2 className="mt-2 text-xl font-semibold break-words sm:text-2xl">
                {apprenticeship.mentor.name}
              </h2>
              <p className="text-ink-secondary mt-2 text-sm leading-6">
                {apprenticeship.mentor.realm}
                {apprenticeship.mentor.realmStage}
                {apprenticeship.mentor.realm ? ' · ' : ''}
                {dateLabel(apprenticeship.startedAt)}拜入门下
              </p>
            </div>
            <ContactActions
              relation={apprenticeship}
              busy={busy}
              onChat={onChat}
            />
          </header>

          {apprenticeship.graduation.ready ? (
            <div className="border-teal/25 bg-teal/4 mt-5 border-l-2 px-4 py-4">
              <p className="text-teal font-semibold">四项皆成，可以出师了</p>
              <p className="text-ink-secondary mt-2 text-sm leading-7">
                你获得{' '}
                <span className="text-teal font-mono">
                  {MENTORSHIP_CONFIG.discipleReputationReward}
                </span>{' '}
                声望，师父获得{' '}
                <span className="text-teal font-mono">
                  {MENTORSHIP_CONFIG.mentorReputationReward}
                </span>{' '}
                声望，并向世界公布出师喜讯。
              </p>
              <InkButton
                variant="primary"
                disabled={!!busy}
                onClick={() => onGraduate(apprenticeship)}
                className="mt-2 -ml-1.5 min-h-11"
              >
                自主出师
              </InkButton>
            </div>
          ) : null}
          <div className="mt-7">
            <GraduationProgress progress={apprenticeship.graduation} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {!apprenticeship.graduation.ready ? (
              <p className="text-ink-secondary text-xs leading-6">
                四项达成后可自主出师，无须师父批准。
              </p>
            ) : (
              <span />
            )}
            <InkButton
              variant="secondary"
              disabled={!!busy}
              onClick={() => onRelation(apprenticeship)}
              className="min-h-11"
            >
              关系管理
            </InkButton>
          </div>
        </section>
      ) : graduation ? (
        <section
          className={teaches ? 'border-ink/15 border-t pt-6' : undefined}
        >
          <p className="text-teal text-xs tracking-widest">师承有成</p>
          <h2 className="mt-3 text-xl leading-9 font-semibold">
            已从 {graduation.mentor.name} 门下出师
          </h2>
          {graduation.endedAt ? (
            <p className="text-ink-secondary mt-2 text-sm">
              {dateLabel(graduation.endedAt)}
            </p>
          ) : null}
          {graduation.graduationRewardedAt &&
          typeof graduation.discipleReputationReward === 'number' ? (
            <p className="text-teal mt-3 text-sm">
              出师声望{' '}
              <span className="font-mono">
                +{graduation.discipleReputationReward}
              </span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2">
            <ContactActions relation={graduation} busy={busy} onChat={onChat} />
            <InkButton
              onClick={() => onTab('records')}
              variant="secondary"
              className="min-h-11"
            >
              翻阅桃李簿
            </InkButton>
          </div>
        </section>
      ) : !teaches && !outgoing.length ? (
        <section className="py-4 sm:py-8">
          <p className="text-ink-secondary text-xs tracking-widest">
            {data.eligibility.canApprentice ? '师缘待结' : '道途未止'}
          </p>
          <h2 className="mt-3 text-xl leading-9 font-semibold">
            {data.eligibility.canApprentice
              ? '寻一位引路人'
              : data.eligibility.permanentlyBound
                ? '师承已记入道途'
                : '继续修行，静待传道之时'}
          </h2>
          <p className="text-ink-secondary mt-3 max-w-lg text-sm leading-7">
            {data.eligibility.canApprentice
              ? '元婴以前可拜师，与师父通过好友私聊交流，修行进境由自己完成。'
              : data.eligibility.permanentlyBound
                ? '此账号已结过师缘，无法再次拜师。达到化神期后，可以招收自己的弟子。'
                : '当前境界已无法拜师。达到化神期后，可以招收弟子、传授心得。'}
          </p>
          {data.eligibility.canApprentice ? (
            <InkButton
              variant="primary"
              onClick={() => onTab('mentors')}
              className="mt-5 -ml-1.5 min-h-11"
            >
              寻访师父
            </InkButton>
          ) : null}
        </section>
      ) : null}

      {apprenticeship ? mentorSection : null}

      {outgoing.length ? (
        <AwaitingRequest
          request={outgoing[0]}
          count={outgoing.length}
          onTab={onTab}
        />
      ) : null}
    </div>
  );
}
