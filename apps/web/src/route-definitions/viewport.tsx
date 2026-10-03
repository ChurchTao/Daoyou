import { Route } from 'react-router';
import { characterRoutes } from './viewport/character';
import { cultivationRoutes } from './viewport/cultivation';
import { dailyRoutes } from './viewport/daily';
import { sectRoutes } from './viewport/sect';
import { servicesRoutes } from './viewport/services';

export const viewportRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameViewportLayout,
    })}
  >
    {[
      ...characterRoutes,
      ...dailyRoutes,
      ...sectRoutes,
      ...cultivationRoutes,
      ...servicesRoutes,
    ]}
  </Route>
);
