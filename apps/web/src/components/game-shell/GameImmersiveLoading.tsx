import { AppViewportColor } from '@app/components/layout/AppViewportColor';
import { GameLoadingState } from './GameLoadingState';

export function GameImmersiveLoading({
  message = '天机流转中……',
}: {
  message?: string;
}) {
  return (
    <div className="app-safe-area-page h-full min-h-dvh bg-[#111713]">
      <AppViewportColor color="#111713" />
      <GameLoadingState message={message} variant="immersive" />
    </div>
  );
}
