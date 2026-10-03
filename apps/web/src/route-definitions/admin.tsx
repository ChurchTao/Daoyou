import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { title } from './handles';

export const adminRoutes = (
  <Route
    path="/admin"
    lazy={lazyRoute(() => import('@app/routes/admin/layout'))}
    handle={title('万界司天台')}
  >
    <Route
      index
      lazy={lazyRoute(() => import('@app/routes/admin/route'))}
      handle={title('总览')}
    />
    <Route
      path="feedback"
      lazy={lazyRoute(() => import('@app/routes/admin/feedback/route'))}
      handle={title('用户反馈')}
    />
    <Route
      path="accounts"
      lazy={lazyRoute(() => import('@app/routes/admin/accounts/route'))}
      handle={title('账号管理')}
    />
    <Route
      path="broadcast/game-mail"
      lazy={lazyRoute(
        () => import('@app/routes/admin/broadcast/game-mail/route'),
      )}
      handle={title('系统邮件')}
    />
    <Route
      path="announcement"
      lazy={lazyRoute(() => import('@app/routes/admin/announcement/route'))}
      handle={title('游戏公告')}
    />
    <Route
      path="item-library"
      lazy={lazyRoute(() => import('@app/routes/admin/item-library/route'))}
      handle={title('材料库')}
    />
    <Route
      path="reputation-shop"
      lazy={lazyRoute(() => import('@app/routes/admin/reputation-shop/route'))}
      handle={title('声望商店管理')}
    />
    <Route
      path="sect-shop"
      lazy={lazyRoute(() => import('@app/routes/admin/sect-shop/route'))}
      handle={title('宗门宝库管理')}
    />
    <Route
      path="redeem-codes"
      lazy={lazyRoute(() => import('@app/routes/admin/redeem-codes/route'))}
      handle={title('兑换码管理')}
    />
    <Route
      path="redeem-codes/new"
      lazy={lazyRoute(() => import('@app/routes/admin/redeem-codes/new/route'))}
      handle={title('新建兑换码')}
    />
    <Route
      path="sponsorship"
      lazy={lazyRoute(() => import('@app/routes/admin/sponsorship/route'))}
      handle={title('功德簿管理')}
    />
    <Route
      path="llm-metrics"
      lazy={lazyRoute(() => import('@app/routes/admin/llm-metrics/route'))}
      handle={title('LLM 观测')}
    />
    <Route
      path="online-users"
      lazy={lazyRoute(() => import('@app/routes/admin/online-users/route'))}
      handle={title('在线人数')}
    />
    <Route
      path="tower-enemy-sets"
      lazy={lazyRoute(() => import('@app/routes/admin/tower-enemy-sets/route'))}
      handle={title('蜃楼敌人')}
    />
    <Route
      path="community-group"
      lazy={lazyRoute(() => import('@app/routes/admin/community-qrcode/route'))}
      handle={title('QQ交流群')}
    />
  </Route>
);
