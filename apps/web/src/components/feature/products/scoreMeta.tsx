import { ScoreMark } from '@app/components/ui/ScoreMark';
import type { ReactNode } from 'react';

export function getScoreMark(
  score?: number | null,
  className?: string,
): ReactNode | undefined {
  if (!score || score <= 0) return undefined;

  return <ScoreMark score={score} className={className} />;
}
