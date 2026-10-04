import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from './handles';

export const combatRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/combat-v6-layout')).CombatV6Layout,
    })}
  >
    <Route
      path="combat-v6/hunt/:battleId"
      lazy={lazyRoute(() => import('@app/routes/game/combat-v6/arena/route'))}
      handle={scene(
        { id: 'hunt', chrome: 'immersive', dock: 'hidden' },
        '结伴讨伐',
      )}
    />
    <Route
      path="combat-v6/arena/:battleId"
      lazy={lazyRoute(() => import('@app/routes/game/combat-v6/arena/route'))}
      handle={scene(
        { id: 'arena-sparring', chrome: 'immersive', dock: 'hidden' },
        '擂台切磋',
      )}
    />
    <Route
      path="training-room"
      lazy={lazyRoute(() => import('@app/routes/game/training-room/route'))}
      handle={scene(
        {
          id: 'training-room',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '练功房',
      )}
    />
    <Route
      path="wild"
      lazy={lazyRoute(() => import('@app/routes/game/wild/route'))}
      handle={scene(
        { id: 'wild', chrome: 'immersive', dock: 'hidden' },
        '野外寻觅',
      )}
    />
  </Route>
);
