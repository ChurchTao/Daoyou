import { lazyRoute } from '@app/lib/router/lazyRoute';
import { GAME_ROUTE_ID } from '@app/lib/router/routeData';
import { Route } from 'react-router';
import { activityRoutes } from './activity';
import { battleRoutes } from './battle';
import { combatRoutes } from './combat';
import { dungeonRoutes } from './dungeon';
import { title } from './handles';
import { mapRoutes } from './map';
import { narrativeRoutes } from './narrative';
import { viewportRoutes } from './viewport';

export const gameRoutes = (
  <Route
    id={GAME_ROUTE_ID}
    path="/game"
    lazy={lazyRoute(() => import('@app/routes/game/layout'))}
  >
    <Route
      lazy={async () => ({
        Component: (await import('@app/layouts/game-layout')).GameGenesisLayout,
      })}
    >
      <Route
        path="create"
        lazy={lazyRoute(() => import('@app/routes/game/create/route'))}
        handle={title('凝气篇')}
      />
      <Route
        path="reincarnate"
        lazy={lazyRoute(() => import('@app/routes/game/reincarnate/route'))}
        handle={title('转世重修')}
      />
    </Route>

    <Route
      lazy={async () => ({
        Component: (await import('@app/layouts/game-layout')).PlayerShellLayout,
      })}
    >
      {narrativeRoutes}

      {viewportRoutes}

      {activityRoutes}

      {combatRoutes}
      {battleRoutes}

      {mapRoutes}

      {dungeonRoutes}
    </Route>
  </Route>
);
