import type { ReactNode } from 'react';

function normalizeSceneText(value: ReactNode): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return `${value}`.replace(/[【】[\]\s]/g, '').trim();
  }

  return null;
}

export interface ResolvedGameSceneFrameHeader {
  label: string;
  contextLabel: string | null;
  summary: string | null;
}

export function resolveGameSceneFrameHeader({
  sceneLabel,
  sceneSummary,
  title,
  description,
}: {
  sceneLabel?: string | null;
  sceneSummary?: string | null;
  title?: ReactNode;
  description?: ReactNode;
}): ResolvedGameSceneFrameHeader {
  const normalizedTitle = normalizeSceneText(title);
  const normalizedSceneLabel = normalizeSceneText(sceneLabel);

  return {
    label: sceneLabel ?? normalizedTitle ?? '道途',
    contextLabel:
      normalizedTitle && normalizedSceneLabel && normalizedTitle !== normalizedSceneLabel
        ? normalizedTitle
        : null,
    summary:
      sceneSummary?.trim() ||
      (typeof description === 'string' ? description.trim() : null) ||
      null,
  };
}
