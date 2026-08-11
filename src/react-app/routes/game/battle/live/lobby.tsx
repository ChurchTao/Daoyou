import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

interface BattleInvitation {
  readonly matchId: string;
  readonly teamId: string;
  readonly cultivatorIds: readonly string[];
  readonly createdAt: string;
}

export default function LiveBattleLobbyPage() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<readonly BattleInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/battle-matches/invitations', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { invitations?: BattleInvitation[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? '无法读取战斗邀请');
        if (!cancelled) setInvitations(body.invitations ?? []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '无法读取战斗邀请');
      });
    return () => { cancelled = true; };
  }, []);

  const accept = async (matchId: string) => {
    setAccepting(matchId);
    setError(null);
    try {
      const response = await fetch(`/api/battle-matches/${encodeURIComponent(matchId)}/accept`, { method: 'POST', credentials: 'include' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? '接受邀请失败');
      navigate(`/game/battle/live/${encodeURIComponent(matchId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '接受邀请失败');
      setAccepting(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col bg-[#eee7d6] px-4 py-6 text-[#2c1810] md:px-8">
      <header className="border-b border-[#2c1810]/20 pb-4">
        <p className="text-xs tracking-[0.22em] text-[#2c1810]/55">多人同步战斗</p>
        <h1 className="mt-1 text-xl font-semibold tracking-[0.12em]">待应战书</h1>
      </header>
      {error && <p className="mt-5 border border-[#8f2433]/35 bg-[#8f2433]/5 p-3 text-sm text-[#8f2433]">{error}</p>}
      <section className="mt-6 grid gap-3">
        {invitations.map((invitation) => (
          <article key={invitation.matchId} className="flex items-center justify-between gap-4 border border-[#2c1810]/15 bg-white/35 p-4">
            <div>
              <strong className="text-sm">{invitation.matchId}</strong>
              <p className="mt-1 text-xs text-[#2c1810]/55">{invitation.teamId} · 控制 {invitation.cultivatorIds.length} 名角色</p>
            </div>
            <button type="button" disabled={accepting !== null} onClick={() => void accept(invitation.matchId)} className="border border-[#8f2433]/45 px-4 py-2 text-sm text-[#8f2433] disabled:opacity-40">
              {accepting === invitation.matchId ? '入阵中…' : '接受并入阵'}
            </button>
          </article>
        ))}
        {invitations.length === 0 && !error && <p className="py-12 text-center text-sm text-[#2c1810]/50">暂未收到新的战斗邀请。</p>}
      </section>
    </main>
  );
}
