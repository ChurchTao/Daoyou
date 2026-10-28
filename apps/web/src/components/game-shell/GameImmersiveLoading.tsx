import { AppViewportColor } from '@app/components/layout/AppViewportColor';
import { GameLoadingState } from './GameLoadingState';

export function GameImmersiveLoading({
  message = '天机流转中……',
}: {
  message?: string;
}) {
  return (
    <div className="app-safe-area-page h-full min-h-dvh bg-scene">
      <AppViewportColor color="#141918" />
      <GameLoadingState message={message} variant="immersive" />
    </div>
  );
}
