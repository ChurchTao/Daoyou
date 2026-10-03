import { lazyRoute } from '@app/lib/router/lazyRoute';
import { AUTH_LAYOUT_ROUTE_ID } from '@app/lib/router/routeData';
import { Route } from 'react-router';
import { title } from './handles';
export const authRoutes = (
  <Route
    id={AUTH_LAYOUT_ROUTE_ID}
    lazy={lazyRoute(() => import('@app/routes/auth/layout'))}
  >
    <Route
      path="/login"
      lazy={lazyRoute(() => import('@app/routes/login/route'))}
      handle={title('【登录】')}
    />
    <Route
      path="/login/email"
      lazy={lazyRoute(() => import('@app/routes/login/email/route'))}
      handle={title('【邮箱验证码】')}
    />
    <Route
      path="/login/password"
      lazy={lazyRoute(() => import('@app/routes/login/password/route'))}
      handle={title('【密码登录】')}
    />
    <Route
      path="/login/verify"
      lazy={lazyRoute(() => import('@app/routes/login/verify/route'))}
      handle={title('【验证码验证】')}
    />
    <Route
      path="/signup"
      lazy={lazyRoute(() => import('@app/routes/signup/route'))}
      handle={title('【注册】')}
    />
    <Route
      path="/signup/password"
      lazy={lazyRoute(() => import('@app/routes/signup/password/route'))}
      handle={title('【密码注册】')}
    />
    <Route
      path="/forgot-password"
      lazy={lazyRoute(() => import('@app/routes/forgot-password/route'))}
      handle={title('【找回密码】')}
    />
    <Route
      path="/reset-password"
      lazy={lazyRoute(() => import('@app/routes/reset-password/route'))}
      handle={title('【重设密码】')}
    />
  </Route>
);
