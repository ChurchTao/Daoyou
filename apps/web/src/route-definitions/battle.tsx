import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from './handles';

export const battleRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameCombatLayout,
    })}
  >
    <Route
      path="battle/challenge"
      lazy={lazyRoute(() => import('@app/routes/game/battle/challenge/route'))}
      handle={scene(
        {
          id: 'battle-challenge',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '挑战天骄',
      )}
    />
    <Route
      path="battle/:id"
      lazy={lazyRoute(() => import('@app/routes/game/battle/detail/route'))}
      handle={scene(
        {
          id: 'battle-replay',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '战斗回放',
      )}
    />
    <Route
      path="tower/battle"
      lazy={lazyRoute(() => import('@app/routes/game/tower/battle/route'))}
      handle={scene(
        {
          id: 'tower-battle',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '蜃楼战局',
      )}
    />
    <Route
      path="tasks/:taskId/challenge"
      lazy={lazyRoute(() => import('@app/routes/game/tasks/challenge/route'))}
      handle={scene(
        {
          id: 'task-challenge',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '破境试炼',
      )}
    />
    <Route
      path="sect/tasks/:taskId/battle"
      lazy={lazyRoute(() => import('@app/routes/game/sect/task-battle/route'))}
      handle={scene(
        {
          id: 'sect-task-battle',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '宗门战局',
      )}
    />
  </Route>
);
