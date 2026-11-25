import { notifyPartyChanged } from '@app/components/feature/party/partyEvents';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkDialog, InkNotice } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import { usePlayerSession } from '@app/lib/resources/player';
import { type CurrentParty, type PartyCommand } from '@daoyou/contracts/party';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

async function requestParty(
  command?: PartyCommand,
  signal?: AbortSignal,
): Promise<CurrentParty> {
  const response = await apiFetch(
    command ? '/api/parties' : '/api/parties/me',
    {
      signal,
      ...(command
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(command),
          }
        : {}),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message ?? body.error ?? '暂时无法读取队伍');
  return body;
}

export default function PartyRoute() {
  const actor = usePlayerSession().data?.activeCultivator?.id;
  return <PartyWorkspace key={actor ?? ''} actor={actor} />;
}

function PartyWorkspace({ actor }: { actor?: string }) {
  const [query, setQuery] = useSearchParams();
  const [value, setValue] = useState<CurrentParty>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [disbandPartyId, setDisbandPartyId] = useState<string>();
  useEffect(() => {
    if (!actor || busy) return;
    const abort = new AbortController();
    let loading = false;
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const next = await requestParty(undefined, abort.signal);
        if (!abort.signal.aborted) setValue(next);
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(cause instanceof Error ? cause.message : '暂时无法读取队伍');
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [actor, busy]);

  const invite = query.get('join');
  const party = value?.party;
  const leader =
    !value?.roleMismatch &&
    party?.members.find((member) => member.userId === party.leaderId)
      ?.cultivatorId === actor;
  async function send(command: PartyCommand) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setValue(await requestParty(command));
      notifyPartyChanged();
      if (command.type === 'join') setQuery({}, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法完成操作');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameSceneFrame variant="workflow">
      <section className="mx-auto grid w-full max-w-lg gap-4">
        {error && <InkNotice tone="danger">{error}</InkNotice>}
        {notice && (
          <p className="text-teal" role="status">
            {notice}
          </p>
        )}
        {!value && !error && (
          <GameLoadingState variant="inline" message="正在读取队伍……" />
        )}
        {value && !party && (
          <div className="grid gap-3">
            <p>
              {invite
                ? '道友邀你入队。'
                : '组队后可一起参加结伴讨伐、古魔入侵和擂台切磋。'}
            </p>
            <InkButton
              variant="primary"
              disabled={busy}
              onClick={() =>
                void send(
                  invite
                    ? { type: 'join', partyId: invite }
                    : { type: 'create' },
                )
              }
            >
              {invite ? '接受邀请' : '组建队伍'}
            </InkButton>
          </div>
        )}
        {party && (
          <>
            <p className="text-ink-secondary">
              <span className="font-mono">{party.members.length}/4</span> 人
              {value?.roleMismatch ? ' · 本账号另一个角色已入队' : ''}
            </p>
            <ul className="divide-ink-border divide-y">
              {party.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    {member.name}{' '}
                    <small className="text-ink-secondary">
                      {member.realm} ·{' '}
                      {member.userId === party.leaderId
                        ? '队长'
                        : (member.title ?? '队员')}
                    </small>
                  </span>
                  {leader && member.userId !== party.leaderId && (
                    <div className="flex gap-1">
                      <InkButton
                        disabled={busy}
                        onClick={() =>
                          void send({
                            type: 'promote',
                            partyId: party.id,
                            userId: member.userId,
                          })
                        }
                      >
                        移交队长
                      </InkButton>
                      <InkButton
                        disabled={busy}
                        onClick={() =>
                          void send({
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
            <div className="flex flex-wrap gap-2">
              <InkButton
                variant="primary"
                disabled={value?.roleMismatch || party.members.length >= 4}
                onClick={() => {
                  const url = new URL('/game/party', window.location.origin);
                  url.searchParams.set('join', party.id);
                  void navigator.clipboard
                    .writeText(url.href)
                    .then(() => setNotice('邀请链接已复制'))
                    .catch(() => setError('无法复制邀请链接'));
                }}
              >
                复制邀请链接
              </InkButton>
              <InkButton
                variant="secondary"
                disabled={busy}
                onClick={() => void send({ type: 'leave', partyId: party.id })}
              >
                退出队伍
              </InkButton>
              {leader && party.members.length > 1 && (
                <InkButton
                  disabled={busy}
                  onClick={() => setDisbandPartyId(party.id)}
                >
                  解散队伍
                </InkButton>
              )}
            </div>
          </>
        )}
      </section>
      <InkDialog
        dialog={
          disbandPartyId
            ? {
                id: 'disband-party',
                title: '解散队伍',
                content:
                  '所有成员将退出队伍，已分享的邀请链接会失效。已开战的场次按原名单继续。',
                confirmLabel: '确认解散',
                cancelLabel: '取消',
                onConfirm: () =>
                  send({ type: 'disband', partyId: disbandPartyId }),
              }
            : null
        }
        onClose={() => setDisbandPartyId(undefined)}
      />
    </GameSceneFrame>
  );
}
