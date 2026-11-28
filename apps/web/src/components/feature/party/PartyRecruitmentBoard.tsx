import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton, InkDropdownSelect, InkNotice } from '@app/components/ui';
import {
  PARTY_APPLICATION_LIMIT,
  PARTY_CAPACITY,
  PARTY_RECRUITMENT_LABELS,
  PartyRecruitmentIntentSchema,
  type PartyApplication,
  type PartyRecruitment,
} from '@daoyou/contracts/party';
import { useEffect, useState } from 'react';
import { PartyPortrait } from './PartyPortrait';
import { requestParty } from './partyWorkspaceApi';
import { useParty, type PartyRecruitmentFocus } from './useParty';

const recruitmentOptions = [
  { value: '', label: '全部玩法' },
  ...PartyRecruitmentIntentSchema.options.map((intent) => ({
    value: intent,
    label: PARTY_RECRUITMENT_LABELS[intent],
  })),
];

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

export function PartyRecruitmentBoard({
  focus,
  invite,
  applications,
  onToggleApplications,
}: {
  focus?: PartyRecruitmentFocus;
  invite?: string;
  applications: boolean;
  onToggleApplications: () => void;
}) {
  const { busy, send, value } = useParty();
  const [kind, setKind] = useState<string>(focus?.kind ?? '');
  const [load, setLoad] = useState<{
    path: string;
    items?: PartyRecruitment[];
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  const path = invite ?? `/recruitments?${params}`;

  useEffect(() => {
    if (applications) return;
    const abort = new AbortController();
    let timer: number;
    const list = async () => {
      try {
        const items = invite
          ? [
              await requestParty<PartyRecruitment>(path, {
                signal: abort.signal,
              }),
            ]
          : (
              await requestParty<{ items: PartyRecruitment[] }>(path, {
                signal: abort.signal,
              })
            ).items;
        if (!abort.signal.aborted) setLoad({ path, items });
      } catch (cause) {
        if (!abort.signal.aborted)
          setLoad({
            path,
            error: cause instanceof Error ? cause.message : '暂时无法读取招募',
          });
      } finally {
        if (!abort.signal.aborted && !invite)
          timer = window.setTimeout(() => {
            if (!document.hidden) void list();
          }, 12000);
      }
    };
    const refreshVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void list();
    };
    void list();
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [applications, invite, path, retry]);

  const current = load?.path === path ? load : undefined;
  const outgoing = value?.outgoing ?? [];
  const pending = outgoing.filter((item) => item.status === 'pending');

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="便捷组队">
      {(!invite || outgoing.length > 0 || applications) && (
        <div className="border-ink-border flex shrink-0 flex-wrap items-center justify-between gap-x-2 border-b pb-1">
          {!invite && !applications && (
            <InkDropdownSelect
              label="招募玩法"
              value={kind}
              options={recruitmentOptions}
              onChange={setKind}
            />
          )}
          <div className="ms-auto flex flex-wrap items-center gap-x-1">
            {!invite && !applications && (
              <InkButton
                variant="secondary"
                className="min-h-11"
                onClick={() => setRetry((count) => count + 1)}
              >
                刷新
              </InkButton>
            )}
            {(outgoing.length > 0 || applications) && (
              <InkButton
                variant="secondary"
                className="min-h-11"
                onClick={onToggleApplications}
              >
                {applications
                  ? invite
                    ? '返回邀请'
                    : '返回招募'
                  : pending.length
                    ? `我的申请（${pending.length}）`
                    : '我的申请'}
              </InkButton>
            )}
          </div>
        </div>
      )}
      <div className="battle-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {applications ? (
          <ul className="divide-ink-border divide-y">
            {outgoing.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-3 py-3 text-sm"
              >
                <div className="min-w-0 wrap-anywhere">
                  <strong>{item.partyLabel}的队伍</strong>
                  <p className="text-ink-secondary mt-1">
                    {item.label} · {applicationStatus[item.status]}
                    {item.status === 'pending' && (
                      <>
                        {' '}
                        ·{' '}
                        <span className="font-mono">
                          {expiresTime.format(item.expiresAt)}
                        </span>{' '}
                        前有效
                      </>
                    )}
                  </p>
                </div>
                {item.status === 'pending' && (
                  <InkButton
                    variant="secondary"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() =>
                      void send({ type: 'cancel', applicationId: item.id })
                    }
                  >
                    撤回
                  </InkButton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            {pending.length >= PARTY_APPLICATION_LIMIT && (
              <p className="text-ink-secondary py-2 text-sm">
                已有 {PARTY_APPLICATION_LIMIT}{' '}
                条待审申请，可在「我的申请」撤回。
              </p>
            )}
            {current?.error ? (
              <InkNotice tone="warning">{current.error}</InkNotice>
            ) : !current ? (
              <GameLoadingState variant="inline" message="正在查看招募……" />
            ) : current.items?.length ? (
              <ul className="divide-ink-border divide-y">
                {current.items.map((entry) => (
                  <li
                    key={`${entry.partyId}:${entry.source.kind}`}
                    className="border-ink-border grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3"
                  >
                    <PartyPortrait
                      member={entry.leader}
                      className="size-12"
                    />
                    <div className="min-w-0 wrap-anywhere">
                      <p className="text-sm font-semibold">
                        {entry.label}{' '}
                        <span className="text-ink-secondary font-mono text-xs">
                          {entry.memberCount}/{PARTY_CAPACITY}
                        </span>
                      </p>
                      <p className="text-ink-secondary mt-0.5 text-xs leading-5">
                        {entry.leader.name} · {entry.leader.realm}
                        {entry.leader.realmStage}
                      </p>
                      {entry.requirement && (
                        <p className="text-ink-secondary text-xs leading-5">
                          招募境界 {entry.requirement}
                        </p>
                      )}
                    </div>
                    {pending.some((item) => item.partyId === entry.partyId) ? (
                      <span className="text-teal text-sm" role="status">
                        待审核
                      </span>
                    ) : entry.memberCount >= PARTY_CAPACITY ? (
                      <span className="text-ink-secondary text-sm">已满员</span>
                    ) : (
                      <InkButton
                        className="min-h-11"
                        variant="primary"
                        disabled={
                          busy || pending.length >= PARTY_APPLICATION_LIMIT
                        }
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-secondary py-6 text-sm">
                当前暂无招募，可先创建队伍。
              </p>
            )}
          </>
        )}
      </div>
      {!invite && !applications && (
        <footer className="border-ink-border flex shrink-0 justify-end border-t pt-2">
          <InkButton
            className="min-h-11"
            variant="primary"
            disabled={busy}
            onClick={() => void send({ type: 'create' })}
          >
            创建队伍
          </InkButton>
        </footer>
      )}
    </section>
  );
}
