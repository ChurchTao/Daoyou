import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route, replace } from 'react-router';
import { scene, sectVisitTitle } from './handles';

export const mapRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameMapLayout,
    })}
  >
    <Route
      path="map-v2"
      lazy={lazyRoute(() => import('@app/routes/game/map-v2/route'))}
      handle={scene(
        { id: 'map', chrome: 'immersive', dock: 'hidden' },
        '山河舆图',
      )}
    />
    <Route
      path="map"
      loader={({ request }) =>
        replace(`/game/map-v2${new URL(request.url).search}`)
      }
    />
    <Route
      path="sect/:sectId/visit"
      lazy={lazyRoute(() => import('@app/routes/game/sect/visit/route'))}
      handle={scene(
        {
          id: 'sect-visit',
          chrome: 'immersive',
          dock: 'hidden',
        },
        sectVisitTitle,
      )}
    />
    <Route
      path="sect/:sectId/gate"
      lazy={lazyRoute(() => import('@app/routes/game/sect/foreign-gate/route'))}
      handle={scene(
        {
          id: 'sect-foreign-gate',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '外宗山门',
      )}
    />
  </Route>
);
