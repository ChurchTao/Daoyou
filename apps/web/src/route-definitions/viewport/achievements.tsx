import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const achievementRoutes = [
  <Route
    path="achievements"
    lazy={lazyRoute(() => import('@app/routes/game/achievements/route'))}
    handle={scene(
      {
        id: 'achievements',
        presentation: 'archive',
        summary: '记录道途所得，续写下一段成就。',
      },
      '成就',
    )}
  />,
];
