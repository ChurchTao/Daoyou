import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from './handles';

export const activityRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameActivityLayout,
    })}
  >
    <Route
      path="sect/gate/sweep"
      lazy={lazyRoute(() => import('@app/routes/game/sect/gate/sweep/route'))}
      handle={scene(
        {
          id: 'sect-gate-sweep',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '清扫山门',
      )}
    />
    <Route
      path="sect/spirit-vein/mining"
      lazy={lazyRoute(
        () => import('@app/routes/game/sect/spirit-vein/mining/route'),
      )}
      handle={scene(
        {
          id: 'sect-spirit-vein-mining',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '灵矿采掘',
      )}
    />
  </Route>
);
