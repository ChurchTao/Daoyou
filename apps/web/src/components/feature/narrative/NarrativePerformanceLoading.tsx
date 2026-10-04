import { GameImmersiveLoading } from '@app/components/game-shell/GameImmersiveLoading';

export function NarrativePerformanceLoading({ message }: { message: string }) {
  return <GameImmersiveLoading message={message} />;
}
