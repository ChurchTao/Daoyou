import App, { RootRouteErrorBoundary } from '@app/App';
import { AppBootScreen } from '@app/components/feature/app-boot/AppBootScreen';
import { lazyRoute } from '@app/lib/router/lazyRoute';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router';
import { adminRoutes } from './route-definitions/admin';
import { authRoutes } from './route-definitions/auth';
import { gameRoutes } from './route-definitions/game';
import { title } from './route-definitions/handles';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      element={<App />}
      errorElement={<RootRouteErrorBoundary />}
      HydrateFallback={AppBootScreen}
    >
      <Route index lazy={lazyRoute(() => import('@app/routes/index/route'))} />
      <Route
        path="/battle-replay/:shareCode"
        lazy={lazyRoute(() => import('@app/routes/battle-replay/route'))}
        handle={title('公开战谱')}
      />
      <Route
        path="/combat-replay/:shareCode"
        lazy={lazyRoute(() => import('@app/routes/combat-replay/route'))}
        handle={title('公开战谱')}
      />
      {authRoutes}
      {gameRoutes}

      {adminRoutes}

      <Route
        path="*"
        lazy={lazyRoute(() => import('@app/routes/not-found'))}
        handle={title('缘分未至')}
      />
    </Route>,
  ),
);
