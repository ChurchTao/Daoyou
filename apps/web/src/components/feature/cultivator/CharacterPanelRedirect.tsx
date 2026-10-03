import { Navigate, useSearchParams } from 'react-router';

export function CharacterPanelRedirect({ tab }: { tab: 'manuals' | 'body' }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('tab', tab);
  return <Navigate to={`/game/cultivator?${next}`} replace />;
}
