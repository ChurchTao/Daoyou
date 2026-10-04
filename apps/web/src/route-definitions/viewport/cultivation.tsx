import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const cultivationRoutes = [
  <Route
    path="artifact-migration"
    lazy={lazyRoute(() => import('@app/routes/game/artifact-migration/route'))}
    handle={scene(
      {
        id: 'artifact-migration',
        presentation: 'workflow',
        summary: '将旧法宝转为当前可用的道装。',
      },
      '旧法宝焕新',
    )}
  />,
  <Route
    path="manual-migration"
    lazy={lazyRoute(() => import('@app/routes/game/manual-migration/route'))}
    handle={scene(
      {
        id: 'manual-migration',
        presentation: 'workflow',
        summary: '将旧功法转为当前可用的传承。',
      },
      '旧功法传承',
    )}
  />,
  <Route
    path="craft/refine"
    lazy={lazyRoute(() => import('@app/routes/game/craft/refine/route'))}
    handle={scene(
      {
        id: 'refine',
        summary: '选择器形与材料，核对消耗后开炉打造。',
      },
      '【炼器室】',
    )}
  />,
  <Route
    path="enlightenment"
    lazy={lazyRoute(() => import('@app/routes/game/enlightenment/route'))}
    handle={scene(
      {
        id: 'enlightenment',
        presentation: 'hub',
        summary: '静心研读典籍，将所悟功法凝录为玉简。',
      },
      '【悟道室】',
    )}
  />,
  <Route
    path="inscriptions"
    lazy={lazyRoute(() => import('@app/routes/game/inscriptions/route'))}
    handle={scene(
      {
        id: 'inscriptions',
        summary: '研材绘纹，合纹升阶，将阵法烙入道装。',
      },
      '【阵纹室】',
    )}
  />,
  <Route
    path="enlightenment/gongfa"
    lazy={lazyRoute(
      () => import('@app/routes/game/enlightenment/gongfa/route'),
    )}
    handle={scene(
      {
        id: 'gongfa-enlightenment',
        summary: '参悟玉简，将所学铭刻于道基。',
      },
      '【功法参悟】',
    )}
  />,
  <Route
    path="fate-reshape"
    lazy={lazyRoute(() => import('@app/routes/game/fate-reshape/route'))}
    handle={scene(
      {
        id: 'fate-reshape',
        summary: '用天机逆命符重抽命格，选出 3 个替换当前命格。',
      },
      '重塑命格',
    )}
  />,
];
