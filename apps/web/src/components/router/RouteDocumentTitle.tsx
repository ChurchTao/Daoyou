import { useLocation, useMatches } from 'react-router';
import { formatDocumentTitle, resolveRouteTitle } from '@app/lib/router/routeTitle';

export function RouteDocumentTitle() {
  const location = useLocation();
  const matches = useMatches();
  const title = formatDocumentTitle(resolveRouteTitle(matches, location));

  return <title>{title}</title>;
}
