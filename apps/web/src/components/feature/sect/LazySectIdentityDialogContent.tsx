import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { lazy, Suspense } from 'react';

const SectIdentityDialogContent = lazy(() =>
  import('./SectIdentity').then((module) => ({
    default: module.SectIdentityDialogContent,
  })),
);

export function LazySectIdentityDialogContent() {
  return (
    <Suspense
      fallback={
        <GameLoadingState variant="inline" message="正在读取宗门玉牒……" />
      }
    >
      <SectIdentityDialogContent />
    </Suspense>
  );
}
