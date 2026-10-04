import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from './handles';

export const narrativeRoutes = (
  <Route
    lazy={async () => ({
      Component: (await import('@app/layouts/game-layout')).GameNarrativeLayout,
    })}
  >
    <Route
      path="identity-reshape"
      lazy={lazyRoute(() => import('@app/routes/game/identity-reshape/route'))}
      handle={scene(
        {
          id: 'identity-reshape',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '改天换地',
      )}
    />
    <Route
      path="story"
      lazy={lazyRoute(() => import('@app/routes/game/story/route'))}
      handle={scene(
        {
          id: 'story',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '入世',
      )}
    />
    {import.meta.env.DEV ? (
      <Route
        path="story/preview/:scriptId?"
        lazy={lazyRoute(() => import('@app/routes/game/story/preview/route'))}
        handle={scene(
          {
            id: 'story-preview',
            chrome: 'immersive',
            dock: 'hidden',
          },
          '看演出',
        )}
      />
    ) : null}
    <Route
      path="sect/onboarding"
      lazy={lazyRoute(() => import('@app/routes/game/sect/onboarding/route'))}
      handle={scene(
        {
          id: 'sect-onboarding',
          chrome: 'immersive',
          dock: 'hidden',
        },
        '诸宗山门',
      )}
    />
  </Route>
);
