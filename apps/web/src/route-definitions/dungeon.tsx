import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from './handles';

export const dungeonRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameDungeonLayout,
    })}
  >
    <Route
      path="dungeon"
      lazy={lazyRoute(() => import('@app/routes/game/dungeon/route'))}
      handle={scene(
        {
          id: 'dungeon',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '云游探秘',
      )}
    />
  </Route>
);
