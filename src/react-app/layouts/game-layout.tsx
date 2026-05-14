import { InkButton } from '@app/components/ui/InkButton';
import { PlayerProvider, usePlayer } from '@app/lib/player/PlayerProvider';
import { Outlet } from 'react-router';


/**
 * 主游戏区布局
 * - 承载游戏路由分支
 */
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <p className="loading-tip">{message}</p>
    </div>
  );
}

function PlayerShell() {
  const { cultivator, note, hasActiveCultivator, isLoading } = usePlayer();

  if (isLoading && !cultivator && !hasActiveCultivator) {
    return <LoadingScreen message="正在推演命盘……" />;
  }

  if (!hasActiveCultivator) {
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

  return (
    <div className="bg-paper min-h-screen pb-20">
      <Outlet />
    </div>
  );
}

export default function GameLayout() {
  return (
    <div className="bg-paper min-h-screen">
      <Outlet />
    </div>
  );
}

export function PlayerProviderLayout() {
  return (
    <PlayerProvider>
      <PlayerShell />
    </PlayerProvider>
  );
}
