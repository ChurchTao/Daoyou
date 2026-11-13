import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const socialRoutes = [
  <Route
    path="friends"
    lazy={lazyRoute(() => import('@app/routes/game/friends/route'))}
    handle={scene(
      {
        id: 'friends',
        presentation: 'service',
        summary: '选择道友，接续私聊往来。',
      },
      '道友',
    )}
  />,
  <Route
    path="friends/chat/:conversationId"
    lazy={lazyRoute(() => import('@app/routes/game/friends/chat'))}
    handle={scene(
      {
        id: 'friends-chat',
        presentation: 'service',
        summary: '接续与道友的私聊往来。',
      },
      '道友私聊',
    )}
  />,
  <Route
    path="mentorship"
    lazy={lazyRoute(() => import('@app/routes/game/mentorship/route'))}
    handle={scene(
      {
        id: 'mentorship',
        presentation: 'workflow',
        summary: '一脉师承，各自成道。',
      },
      '师徒',
    )}
  />,
];
