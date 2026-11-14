import { InkButton } from '@app/components/ui/InkButton';
import type {
  MentorshipOverview,
  MentorshipRequestView,
} from '@daoyou/contracts/mentorship';
import { ACHIEVEMENT_DEFINITIONS } from '@daoyou/game-content/achievements';

const date = (value: string) =>
  new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
const finishedStatus = {
  accepted: '已结缘',
  rejected: '已婉拒',
  cancelled: '已撤回',
  expired: '已过期',
  pending: '待回应',
};

export function MentorshipRequests({
  data,
  busy,
  onAccept,
  onRespond,
}: {
  data: MentorshipOverview;
  busy: string | null;
  onAccept: (r: MentorshipRequestView) => void;
  onRespond: (r: MentorshipRequestView, action: 'reject' | 'cancel') => void;
}) {
  const current = data.requests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.mentor.id === data.actor.id || r.disciple.id === data.actor.id),
  );
  const incoming = current.filter((r) => r.incoming);
  const outgoing = current.filter((r) => !r.incoming);
  const history = data.requests.filter((r) => !current.includes(r));
  function row(request: MentorshipRequestView) {
    const isMentor = request.mentor.id === data.actor.id;
    const peer = isMentor ? request.disciple : request.mentor;
    return (
      <li
        key={request.id}
        className="border-ink/10 space-y-3 border-b py-5 last:border-b-0"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-ink-secondary mb-1 text-xs">
              {isMentor ? '收徒结缘' : '拜师结缘'}
            </p>
            <h3 className="text-lg font-semibold break-words">{peer.name}</h3>
            <p className="text-ink-secondary mt-1 text-sm">
              {peer.realm}
              {peer.realmStage}
            </p>
          </div>
          <span
            className={
              request.incoming
                ? 'text-crimson shrink-0 pt-1 text-sm'
                : 'text-ink-secondary shrink-0 pt-1 text-sm'
            }
          >
            {request.incoming ? '待你回应' : '等待对方'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-ink-secondary text-xs leading-6">
            {date(request.expiresAt)} 前有效
          </p>
          <div className="flex gap-2">
            {request.incoming ? (
              <>
                <InkButton
                  className="min-h-11"
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => onRespond(request, 'reject')}
                >
                  婉拒
                </InkButton>
                <InkButton
                  className="min-h-11"
                  variant="primary"
                  disabled={!!busy}
                  onClick={() => onAccept(request)}
                >
                  接受师承
                </InkButton>
              </>
            ) : (
              <InkButton
                className="min-h-11"
                variant="secondary"
                pending={busy === 'cancel:' + request.id}
                disabled={!!busy}
                onClick={() => onRespond(request, 'cancel')}
              >
                撤回申请
              </InkButton>
            )}
          </div>
        </div>
      </li>
    );
  }
  return (
    <div className="py-2">
      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">待你回应</h2>
          <span className="text-crimson font-mono text-sm">
            {incoming.length}
          </span>
        </div>
        {incoming.length ? (
          <ul>{incoming.map(row)}</ul>
        ) : (
          <p className="text-ink-secondary py-6 text-sm">暂无待处理的拜帖。</p>
        )}
      </section>
      {outgoing.length ? (
        <section className="border-ink/15 mt-4 border-t pt-5">
          <h2 className="font-semibold">已递出的拜帖</h2>
          <ul>{outgoing.map(row)}</ul>
        </section>
      ) : null}
      {!current.length ? (
        <p className="text-ink-secondary border-ink/10 border-t pt-5 text-sm leading-7">
          可在寻师名录了解师父，也可从好友名片发起结缘。
        </p>
      ) : null}
      {history.length ? (
        <details className="border-ink/15 mt-6 border-t pt-4">
          <summary className="text-ink-secondary focus-visible:outline-crimson min-h-11 cursor-pointer py-2 text-sm">
            已结束与往世申请 ·{' '}
            <span className="font-mono">{history.length}</span>
          </summary>
          <ul className="divide-ink/10 mt-2 divide-y">
            {history.map((request) => (
              <li key={request.id} className="space-y-1 py-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {request.disciple.name} 拜 {request.mentor.name} 为师
                  </span>
                  <span className="text-ink-secondary">
                    {finishedStatus[request.status]}
                  </span>
                </div>
                <p className="text-ink-secondary text-xs">
                  {date(request.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function MentorshipRecords({
  data,
  busy,
  onChat,
}: {
  data: MentorshipOverview;
  busy: string | null;
  onChat: (id: string) => void;
}) {
  const records = data.relations.filter((r) => r.status === 'graduated');
  const count = data.honor.graduatedDisciples;
  const next = ACHIEVEMENT_DEFINITIONS.find(
    (definition) =>
      definition.requirement.metric === 'mentorship.graduated_disciples' &&
      count < definition.requirement.target,
  );
  const showHonor = data.eligibility.canMentor || count > 0;
  return (
    <div className="space-y-7 py-3">
      {showHonor ? (
        <section className="border-teal/25 grid gap-5 border-b pb-6 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div>
            <p className="text-ink-secondary text-xs tracking-widest">
              本角色 · 桃李成蹊
            </p>
            <p className="text-teal mt-2">
              <span className="font-mono text-4xl tracking-tight">{count}</span>
              <span className="text-ink-secondary ml-2 text-sm">
                名弟子已出师
              </span>
            </p>
          </div>
          <div className="self-end">
            {next ? (
              <>
                <p className="text-sm">
                  再育{' '}
                  <span className="font-mono">
                    {next.requirement.target - count}
                  </span>{' '}
                  人，可获「{next.name}」
                </p>
                <div
                  role="progressbar"
                  aria-label={next.name + '成就进度'}
                  aria-valuemin={0}
                  aria-valuemax={next.requirement.target}
                  aria-valuenow={count}
                  className="bg-ink/8 mt-3 h-1"
                >
                  <div
                    className="bg-teal h-full"
                    style={{
                      width: (count / next.requirement.target) * 100 + '%',
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-teal text-sm">桃李天下，师道长存。</p>
            )}
            <InkButton
              className="mt-2 min-h-11"
              variant="secondary"
              href="/game/cultivator?tab=card"
            >
              设置名片成就
            </InkButton>
          </div>
        </section>
      ) : null}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">出师留名</h2>
          <span className="text-ink-secondary text-xs">以礼相承，成道留痕</span>
        </div>
        {records.length ? (
          <ol className="border-ink/10 border-t">
            {records.map((relation) => {
              const current =
                relation.mentor.id === data.actor.id ||
                relation.disciple.id === data.actor.id;
              const peer =
                relation.role === 'mentor'
                  ? relation.disciple
                  : relation.mentor;
              return (
                <li
                  key={relation.id}
                  className="border-ink/10 grid gap-3 border-b py-5 sm:grid-cols-[8rem_1fr_auto] sm:gap-5"
                >
                  <div className="text-ink-secondary text-xs leading-6">
                    {relation.endedAt ? (
                      <time dateTime={relation.endedAt}>
                        {date(relation.endedAt)}
                      </time>
                    ) : (
                      '出师日期未记'
                    )}
                    {!current ? <p>往世记录</p> : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-base leading-7">
                      <span className="font-semibold">
                        {relation.disciple.name}
                      </span>
                      <span className="text-ink-secondary"> 出师于 </span>
                      <span>{relation.mentor.name}</span>
                      <span className="text-ink-secondary"> 门下</span>
                    </p>
                    {relation.graduationRewardedAt &&
                    relation.discipleReputationReward !== null &&
                    relation.mentorReputationReward !== null ? (
                      <p className="text-ink-secondary text-xs leading-6">
                        徒弟声望{' '}
                        <span className="text-teal font-mono">
                          +{relation.discipleReputationReward}
                        </span>{' '}
                        · 师父声望{' '}
                        <span className="text-teal font-mono">
                          +{relation.mentorReputationReward}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {current && peer.id && peer.status === 'active' ? (
                    <InkButton
                      className="min-h-11 self-start justify-self-start"
                      variant="secondary"
                      disabled={!!busy}
                      onClick={() => onChat(peer.id!)}
                    >
                      好友私聊
                    </InkButton>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="border-ink/15 border-y py-10">
            <p className="font-semibold">桃李待成</p>
            <p className="text-ink-secondary mt-2 text-sm leading-7">
              这里将留下正式出师的姓名与日期。平日交流可直接与师父、弟子私聊。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
