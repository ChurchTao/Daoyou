import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { usePwaInstall } from '@app/components/providers/PwaInstallProvider';
import { InkButton } from '@app/components/ui';
import type {
  ActivityImmersiveResult,
  ActivityViewportState,
} from '@app/lib/gameActivityImmersive';
import { useState } from 'react';

interface GameActivityLaunchGateProps {
  viewport: ActivityViewportState;
  attempt?: ActivityImmersiveResult;
  instructions: React.ReactNode;
  exitLabel: string;
  onRetry: () => Promise<void>;
  onContinue: () => void;
  onExit: () => void;
}

function failedToEnterFullscreen(attempt?: ActivityImmersiveResult) {
  return (
    attempt?.fullscreen === 'unsupported' || attempt?.fullscreen === 'rejected'
  );
}

export function GameActivityLaunchGate({
  viewport,
  attempt,
  instructions,
  exitLabel,
  onRetry,
  onContinue,
  onExit,
}: GameActivityLaunchGateProps) {
  const [retrying, setRetrying] = useState(false);
  const pwa = usePwaInstall();
  const fullscreenFailed = failedToEnterFullscreen(attempt);
  const showInstall =
    fullscreenFailed &&
    pwa.status !== 'installed' &&
    pwa.status !== 'unavailable';

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <GameActivityOverlay>
      <p className="text-lg font-semibold">
        {viewport.landscape ? '进入沉浸模式' : '请将设备旋转为横屏'}
      </p>
      <div className="mt-2 text-sm leading-7 text-stone-300">
        {fullscreenFailed ? (
          <p>
            当前浏览器未能进入全屏。横屏后仍可继续；添加到主屏幕可隐藏地址栏。
          </p>
        ) : (
          instructions
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {attempt?.fullscreen !== 'unsupported' ? (
          <InkButton
            variant="primary"
            pending={retrying}
            pendingLabel="正在切换……"
            onClick={() => void retry()}
          >
            {viewport.landscape ? '进入全屏并开始' : '进入横屏全屏'}
          </InkButton>
        ) : null}
        {fullscreenFailed && viewport.landscape ? (
          <InkButton variant="primary" onClick={onContinue}>
            继续当前模式
          </InkButton>
        ) : null}
        {showInstall ? (
          <InkButton variant="secondary" onClick={() => void pwa.install()}>
            {pwa.status === 'promptable' ? '安装到设备' : '查看安装方法'}
          </InkButton>
        ) : null}
        <InkButton variant="secondary" onClick={onExit}>
          {exitLabel}
        </InkButton>
      </div>
    </GameActivityOverlay>
  );
}

export function GameActivityRotationNotice() {
  return (
    <GameActivityOverlay>
      <p className="text-lg font-semibold">请恢复横屏</p>
      <p className="mt-2 text-sm leading-7 text-stone-300">
        当前进度会保留，恢复横屏后即可继续操作。
      </p>
    </GameActivityOverlay>
  );
}

export function GameActivityFullscreenRetry({
  onRetry,
}: {
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  return (
    <button
      type="button"
      className="pointer-events-auto rounded-full bg-black/50 px-3 py-2 text-sm text-stone-100 shadow-lg ring-1 ring-white/15 backdrop-blur-md transition active:scale-95 disabled:opacity-50"
      disabled={retrying}
      onClick={() => {
        if (retrying) return;
        setRetrying(true);
        void onRetry().finally(() => setRetrying(false));
      }}
    >
      {retrying ? '切换中' : '重新全屏'}
    </button>
  );
}

export function GameActivityOverlay({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 pt-[max(env(safe-area-inset-top),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] pl-[max(env(safe-area-inset-left),1.5rem)] backdrop-blur-sm">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

export function GameActivityLoadingOverlay({ message }: { message: string }) {
  return (
    <GameActivityOverlay>
      <GameLoadingState message={message} variant="immersive" />
    </GameActivityOverlay>
  );
}
