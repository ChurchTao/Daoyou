import { InkButton } from '@app/components/ui/InkButton';
import { useAuth } from '@app/lib/auth/AuthContext';
import { PlayerProvider, usePlayer } from '@app/lib/player/PlayerProvider';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';


/**
 * 主游戏区布局
 * - 提供修仙者数据上下文
 */
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <p className="loading-tip">{message}</p>
    </div>
  );
}

function PlayerShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { cultivator, note, hasActiveCultivator, isLoading } = usePlayer();

  // 后台刷新时保留当前页面，避免卸载子路由导致局部交互结果丢失。
  if (isLoading && !cultivator && !hasActiveCultivator) {
    return <LoadingScreen message="正在推演命盘……" />;
  }

  if (!hasActiveCultivator) {
    if (pathname === '/game/create' || pathname === '/game/reincarnate') {
      return <div className="bg-paper min-h-screen pb-20">{children}</div>;
    }

    const isDead = Boolean(note);

    return (
      <div className="bg-paper flex min-h-screen items-center justify-center px-6">
        <div className="border-ink/15 bg-bgpaper/90 w-full max-w-xl rounded border p-6">
          <h1 className="text-xl font-semibold tracking-wide">
            {isDead ? '前世道途已尽' : '尚未凝聚真身'}
          </h1>
          <p className="text-ink-secondary mt-3 text-sm leading-7">
            {note ||
              '当前账号下还没有活跃角色。先完成角色创建，再进入万界修行主流程。'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <InkButton
              variant="primary"
              href={isDead ? '/game/reincarnate' : '/game/create'}
            >
              {isDead ? '前往转世重修' : '前往角色创建'}
            </InkButton>
            <InkButton href="/game">返回主界面</InkButton>
          </div>
        </div>
      </div>
    );
  }

  return <div className="bg-paper min-h-screen pb-20">{children}</div>;
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (isLoading || !user) {
    return <LoadingScreen message="正在进入道界……" />;
  }

  return (
    <PlayerProvider>
      <PlayerShell>{children}</PlayerShell>
    </PlayerProvider>
  );
}
