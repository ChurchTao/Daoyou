import { InkButton, InkNotice } from '@app/components/ui';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  PARTY_CAPACITY,
  PARTY_RECRUITMENT_LABELS,
  PARTY_RECRUITMENT_MINUTES,
  PartyRecruitmentIntentSchema,
  type CurrentParty,
  type PartyCommand,
  type PartyRecruitmentIntent,
  type PartyView,
} from '@daoyou/contracts/party';
import { useEffect, useRef, useState } from 'react';
import { PartyMemberCard } from './PartyMemberCard';
import { PartyPortrait } from './PartyPortrait';
import { partyInviteHref } from './partyWorkspaceApi';
import { useParty, type PartyRecruitmentFocus } from './useParty';
import { usePartyVitals } from './usePartyVitals';

type RosterCommand = Extract<
  PartyCommand,
  { type: 'leave' | 'kick' | 'promote' }
>;
type RosterView = 'members' | 'applications' | 'manage' | 'recruit';

const reviewFeedback = {
  accepted: '已同意入队',
  rejected: '已拒绝申请',
  expired: '这条申请已失效',
  cancelled: '道友已撤回申请',
  pending: '',
};

export function PartyRoster({
  party,
  current,
  focus,
  onInspect,
}: {
  party: PartyView;
  current: CurrentParty;
  focus?: PartyRecruitmentFocus;
  onInspect: (id: string, path: string) => void;
}) {
  const { actorId, busy, send } = useParty();
  const [view, setView] = useState<RosterView>('members');
  const [selected, setSelected] = useState('');
  const [confirm, setConfirm] = useState<RosterCommand>();
  const [note, setNote] = useState('');
  const confirmPanel = useRef<HTMLDivElement>(null);
  const { roleMismatch, incoming, recruitment } = current;
  const [intent, setIntent] = useState<PartyRecruitmentIntent>(
    recruitment?.intent ?? focus?.kind ?? 'any',
  );
  const captain =
    !roleMismatch &&
    party.members.some(
      (member) =>
        member.userId === party.leaderId && member.cultivatorId === actorId,
    );
  const full = party.members.length >= PARTY_CAPACITY;
  const teammates = party.members.filter(
    (member) => member.userId !== party.leaderId,
  );
  const activeView = captain ? view : 'members';
  const vitals = usePartyVitals(
    actorId,
    activeView === 'members' && !roleMismatch ? party : undefined,
  );
  const managed = teammates.find((member) => member.userId === selected);
  const target =
    confirm && 'userId' in confirm
      ? teammates.find((member) => member.userId === confirm.userId)
      : undefined;
  const confirmation =
    confirm?.type === 'leave' || (captain && target) ? confirm : undefined;
  useEffect(() => {
    if (confirmation)
      confirmPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [confirmation]);
  const members = [...party.members].sort(
    (a, b) =>
      Number(b.userId === party.leaderId) - Number(a.userId === party.leaderId),
  );

  async function act(command: PartyCommand) {
    setNote('');
    const result = await send(command);
    if (!result) return;
    setConfirm(undefined);
    if (command.type === 'kick' || command.type === 'promote') {
      setView('members');
      setSelected('');
      setNote(command.type === 'kick' ? '已请离队员' : '已委任新队长');
    } else if (
      command.type === 'recruit' ||
      command.type === 'stop-recruiting'
    ) {
      setView('members');
      setNote(command.type === 'recruit' ? '已发到世界传音' : '已停止招募');
    } else if (result.outcome) setNote(reviewFeedback[result.outcome]);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(
        new URL(partyInviteHref(party.id), window.location.origin).href,
      );
      setNote('已复制入队邀请');
    } catch {
      setNote('暂时无法复制邀请，请重试。');
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="队伍成员">
      <header className="border-ink-border flex min-h-9 shrink-0 items-center justify-between gap-2 border-b pb-2">
        <h3
          className={
            activeView === 'members' ? 'sr-only' : 'text-lg font-semibold'
          }
        >
          {activeView === 'applications'
            ? '入队申请'
            : activeView === 'manage'
              ? '队务'
              : activeView === 'recruit'
                ? '招募道友'
                : '队伍成员'}
        </h3>
        {activeView === 'members' ? (
          <>
            <p className="text-ink-secondary text-sm">
              <b className="font-mono">
                {party.members.length}/{PARTY_CAPACITY}
              </b>{' '}
              人
            </p>
            {recruitment && !full && (
              <span className="text-teal text-sm">
                招募中 · {PARTY_RECRUITMENT_LABELS[recruitment.intent]}
              </span>
            )}
          </>
        ) : (
          <InkButton
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              setView('members');
              setConfirm(undefined);
            }}
          >
            返回成员
          </InkButton>
        )}
      </header>
      <div className="battle-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-4">
        {roleMismatch && (
          <InkNotice tone="warning">
            本账号的另一位角色在队中。请切回该角色查看传音或处理队务。
          </InkNotice>
        )}
        {note && (
          <p className="text-teal text-sm" role="status">
            {note}
          </p>
        )}
        {activeView === 'members' ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => (
              <li
                key={member.cultivatorId}
                className="border-ink-border bg-paper-2/45 min-w-0 rounded-sm border px-3 py-2"
              >
                <PartyMemberCard
                  member={member}
                  captain={member.userId === party.leaderId}
                  self={member.cultivatorId === actorId}
                  online={vitals?.data?.[member.cultivatorId]?.online}
                  sectName={vitals?.data?.[member.cultivatorId]?.sectName}
                  showVitals={!roleMismatch}
                  vitals={
                    vitals?.error
                      ? null
                      : vitals?.data?.[member.cultivatorId]?.vitals
                  }
                  onInspect={
                    roleMismatch
                      ? undefined
                      : () =>
                          onInspect(
                            member.cultivatorId,
                            `/api/parties/members/${member.cultivatorId}/cultivator`,
                          )
                  }
                />
              </li>
            ))}
            {Array.from(
              { length: PARTY_CAPACITY - members.length },
              (_, index) => (
                <li
                  key={index}
                  aria-hidden="true"
                  className="border-ink-border text-ink-secondary/75 flex min-h-11 items-center justify-center rounded-sm border border-dashed text-xs"
                >
                  空席
                </li>
              ),
            )}
          </ul>
        ) : activeView === 'applications' ? (
          <>
            {full && incoming.length > 0 && (
              <p className="text-ink-secondary text-sm">
                队伍已满，空出席位后可同意申请。
              </p>
            )}
            {incoming.length === 0 ? (
              <p className="text-ink-secondary text-sm">暂无待审申请。</p>
            ) : (
              <ul className="divide-ink-border divide-y">
                {incoming.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-3 first:pt-0"
                  >
                    <button
                      type="button"
                      className="focus-visible:outline-crimson hover:text-crimson flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-label={`查看${entry.applicant.name}的名片`}
                      onClick={() =>
                        onInspect(
                          entry.applicant.cultivatorId,
                          `/api/parties/applications/${entry.id}/cultivator`,
                        )
                      }
                    >
                      <PartyPortrait
                        member={entry.applicant}
                        className="border-ink-border bg-paper-2 size-12 overflow-hidden rounded-full border"
                      />
                      <span className="min-w-0 wrap-anywhere">
                        <strong className="block text-sm">
                          {entry.applicant.name}
                        </strong>
                        <span className="text-ink-secondary block text-xs leading-5">
                          {entry.applicant.realm}
                          {entry.applicant.realmStage}
                          {entry.applicant.title &&
                            ` · ${entry.applicant.title}`}
                        </span>
                        <span className="text-ink-secondary block text-xs">
                          {entry.label}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0">
                      <InkButton
                        variant="primary"
                        className="min-h-11"
                        disabled={busy || full}
                        onClick={() =>
                          void act({ type: 'approve', applicationId: entry.id })
                        }
                      >
                        同意
                      </InkButton>
                      <InkButton
                        variant="secondary"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() =>
                          void act({ type: 'reject', applicationId: entry.id })
                        }
                      >
                        拒绝
                      </InkButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : activeView === 'recruit' ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void act({ type: 'recruit', partyId: party.id, intent });
            }}
          >
            <InkSelect
              label="玩法倾向"
              hint={`发布后会同步到世界传音，有效期 ${PARTY_RECRUITMENT_MINUTES} 分钟。`}
              value={intent}
              onChange={(next) =>
                setIntent(PartyRecruitmentIntentSchema.parse(next))
              }
            >
              {PartyRecruitmentIntentSchema.options.map((option) => (
                <option key={option} value={option}>
                  {PARTY_RECRUITMENT_LABELS[option]}
                </option>
              ))}
            </InkSelect>
            {full && (
              <p className="text-ink-secondary text-sm">
                队伍已满，空出席位后可发布。
              </p>
            )}
            <div className="flex flex-wrap gap-x-2">
              <InkButton
                type="submit"
                variant="primary"
                className="min-h-11"
                disabled={busy || full}
              >
                {recruitment ? '重新发布' : '发布招募'}
              </InkButton>
              {recruitment && (
                <InkButton
                  variant="secondary"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() =>
                    void act({ type: 'stop-recruiting', partyId: party.id })
                  }
                >
                  停止招募
                </InkButton>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-3">
              {!full && (
                <InkButton
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void share()}
                >
                  复制邀请
                </InkButton>
              )}
              <InkButton
                variant="secondary"
                className="min-h-11"
                disabled={busy || !!confirmation}
                onClick={() => setConfirm({ type: 'leave', partyId: party.id })}
              >
                离开队伍
              </InkButton>
            </div>
            {teammates.length > 0 && (
              <InkSelect
                label="选择队员"
                value={managed?.userId ?? ''}
                onChange={(id) => {
                  setSelected(id);
                  setConfirm(undefined);
                }}
              >
                <option value="">请选择</option>
                {teammates.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </InkSelect>
            )}
            {managed && !confirmation && (
              <div className="flex flex-wrap gap-2">
                <InkButton
                  className="min-h-11"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      type: 'promote',
                      partyId: party.id,
                      userId: managed.userId,
                    })
                  }
                >
                  委任队长
                </InkButton>
                <InkButton
                  className="min-h-11"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      type: 'kick',
                      partyId: party.id,
                      userId: managed.userId,
                    })
                  }
                >
                  请离队伍
                </InkButton>
              </div>
            )}
          </div>
        )}
        {confirmation && (
          <div
            ref={confirmPanel}
            className="border-crimson/40 bg-crimson/5 space-y-2 border-s-2 p-3"
            role="group"
            aria-label="确认队伍操作"
          >
            <p className="text-sm leading-6">
              {confirmation.type === 'promote'
                ? `「${target?.name}」将接任队长，负责队务和入队审批。`
                : confirmation.type === 'kick'
                  ? `「${target?.name}」将离开队伍。`
                  : captain && teammates.length
                    ? '离队后，队长由其他队员接任。'
                    : '离队后将无法参与这支队伍接下来的挑战。'}
            </p>
            <div className="flex flex-wrap gap-x-2">
              <InkButton
                className="min-h-11"
                variant="primary"
                disabled={busy}
                onClick={() => void act(confirmation)}
              >
                {confirmation.type === 'promote'
                  ? '确认委任'
                  : confirmation.type === 'kick'
                    ? '确认请离'
                    : '确认离队'}
              </InkButton>
              <InkButton
                className="min-h-11"
                variant="secondary"
                onClick={() => setConfirm(undefined)}
              >
                取消
              </InkButton>
            </div>
          </div>
        )}
      </div>
      {activeView === 'members' && !roleMismatch && (
        <footer className="border-ink-border flex shrink-0 items-center gap-x-3 border-t pt-2">
          {captain ? (
            <>
              {(!full || recruitment) && (
                <InkButton
                  className="min-h-11"
                  variant="primary"
                  onClick={() => {
                    setIntent(recruitment?.intent ?? focus?.kind ?? 'any');
                    setView('recruit');
                  }}
                >
                  招募
                </InkButton>
              )}
              <InkButton
                className="min-h-11"
                variant={incoming.length ? 'primary' : 'secondary'}
                onClick={() => setView('applications')}
              >
                申请
                {incoming.length > 0 && (
                  <>
                    {' '}
                    <b className="font-mono">{incoming.length}</b>
                  </>
                )}
              </InkButton>
              <InkButton
                className="min-h-11"
                variant="secondary"
                onClick={() => setView('manage')}
              >
                队务
              </InkButton>
            </>
          ) : (
            <InkButton
              className="min-h-11"
              variant="secondary"
              disabled={busy || !!confirmation}
              onClick={() => setConfirm({ type: 'leave', partyId: party.id })}
            >
              离开队伍
            </InkButton>
          )}
        </footer>
      )}
    </section>
  );
}
