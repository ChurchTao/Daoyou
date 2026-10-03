import { GameLoadingState } from './GameLoadingState';

export function GameImmersiveLoading({
  message = '天机流转中……',
}: {
  message?: string;
}) {
  return (
    <div className="app-safe-area-page h-full min-h-[100svh] bg-[#111713]">
      <GameLoadingState message={message} variant="immersive" />
    </div>
  );
}
