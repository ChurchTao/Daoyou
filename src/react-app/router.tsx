import App, { RootRouteErrorBoundary } from '@app/App';
import GameLayout, {
  GameArenaLayout,
  GameCombatLayout,
  GameMapLayout,
  GameViewportLayout,
  PlayerProviderLayout,
} from '@app/layouts/game-layout';
import { lazyRoute } from '@app/lib/router/lazyRoute';
import {
  guestOnlyLoader,
  indexRedirectLoader,
  requireAdminLoader,
  requireUserLoader,
} from '@app/lib/router/loaders';
import type {
  AppRouteHandle,
  GameSceneHandle,
  RouteTitleResolver,
} from '@app/lib/router/routeTitle';
import { createBrowserRouter, createRoutesFromElements, Outlet, Route } from 'react-router';

const title = (value: RouteTitleResolver): AppRouteHandle => ({ title: value });
const scene = (
  sceneHandle: Omit<GameSceneHandle, 'chrome' | 'dock'> &
    Partial<Pick<GameSceneHandle, 'chrome' | 'dock'>>,
  value: RouteTitleResolver,
): AppRouteHandle => ({
  title: value,
  gameScene: {
    chrome: 'standard',
    dock: 'core',
    ...sceneHandle,
  },
});

const mapTitle: RouteTitleResolver = ({ searchParams }) =>
  searchParams.get('intent') === 'market'
    ? '修仙界地图 · 坊市选址'
    : '修仙界地图 · 历练选址';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<App />} errorElement={<RootRouteErrorBoundary />}>
      <Route index loader={indexRedirectLoader} element={null} />

      <Route element={<Outlet />}>
        <Route
          path="/login"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/login/route'))}
          handle={title('【入界】')}
        />
        <Route
          path="/login/email"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/login/email/route'))}
          handle={title('【邮箱归位】')}
        />
        <Route
          path="/login/password"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/login/password/route'))}
          handle={title('【口令归位】')}
        />
        <Route
          path="/login/verify"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/login/verify/route'))}
          handle={title('【口令验证】')}
        />
        <Route
          path="/signup"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/signup/route'))}
          handle={title('【缔结真身】')}
        />
        <Route
          path="/signup/email"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/signup/email/route'))}
          handle={title('【邮箱建号】')}
        />
        <Route
          path="/signup/password"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/signup/password/route'))}
          handle={title('【口令建号】')}
        />
        <Route
          path="/signup/verify"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/signup/verify/route'))}
          handle={title('【建号验证】')}
        />
        <Route
          path="/forgot-password"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/forgot-password/route'))}
          handle={title('【找回口令】')}
        />
        <Route
          path="/reset-password"
          loader={guestOnlyLoader}
          lazy={lazyRoute(() => import('@app/routes/reset-password/route'))}
          handle={title('【重设口令】')}
        />
      </Route>

      <Route
        path="/ui-demo/game-hud"
        lazy={lazyRoute(() => import('@app/routes/game/ui-demo/route'))}
        handle={title('界面 Demo')}
      />

      <Route path="/game" element={<GameLayout />} loader={requireUserLoader}>
        <Route
          path="create"
          lazy={lazyRoute(() => import('@app/routes/game/create/route'))}
          handle={title('凝气篇')}
        />
        <Route
          path="reincarnate"
          lazy={lazyRoute(() => import('@app/routes/game/reincarnate/route'))}
          handle={title('转世重修')}
        />
        <Route
          path="ui-demo"
          lazy={lazyRoute(() => import('@app/routes/game/ui-demo/route'))}
          handle={title('界面 Demo')}
        />

        <Route element={<PlayerProviderLayout />}>
          <Route element={<GameViewportLayout />}>
            <Route
              index
              lazy={lazyRoute(() => import('@app/routes/game/route'))}
              handle={scene(
                { id: 'cave', label: '洞府', group: 'cultivation' },
                '洞府',
              )}
            />
            <Route
              path="cultivator"
              lazy={lazyRoute(() => import('@app/routes/game/cultivator/route'))}
              handle={scene(
                { id: 'cultivator', label: '道身', group: 'cultivation' },
                '道身',
              )}
            />
            <Route
              path="inventory"
              lazy={lazyRoute(() => import('@app/routes/game/inventory/route'))}
              handle={scene(
                { id: 'inventory', label: '储物袋', group: 'trade' },
                '储物袋',
              )}
            />
            <Route
              path="craft/alchemy"
              lazy={lazyRoute(
                () => import('@app/routes/game/craft/alchemy/route'),
              )}
              handle={scene(
                { id: 'alchemy', label: '炼丹房', group: 'craft' },
                '【炼丹房】',
              )}
            />
            <Route
              path="market"
              lazy={lazyRoute(() => import('@app/routes/game/market/route'))}
              handle={scene(
                { id: 'market', label: '坊市', group: 'trade' },
                '修仙坊市',
              )}
            />
            <Route
              path="mail"
              lazy={lazyRoute(() => import('@app/routes/game/mail/route'))}
              handle={scene(
                { id: 'mail', label: '传音玉简', group: 'service' },
                '传音玉简',
              )}
            />
            <Route
              path="retreat"
              lazy={lazyRoute(() => import('@app/routes/game/retreat/route'))}
              handle={scene(
                { id: 'retreat', label: '洞府修行', group: 'cultivation' },
                '洞府',
              )}
            />
            <Route
              path="skills"
              lazy={lazyRoute(() => import('@app/routes/game/skills/route'))}
              handle={scene(
                { id: 'skills', label: '所修神通', group: 'cultivation' },
                '【所修神通】',
              )}
            />
            <Route
              path="techniques"
              lazy={lazyRoute(() => import('@app/routes/game/techniques/route'))}
              handle={scene(
                { id: 'techniques', label: '所修功法', group: 'cultivation' },
                '【所修功法】',
              )}
            />
            <Route
              path="artifacts"
              lazy={lazyRoute(() => import('@app/routes/game/artifacts/route'))}
              handle={scene(
                { id: 'artifacts', label: '所炼法宝', group: 'craft' },
                '【所炼法宝】',
              )}
            />
            <Route
              path="craft"
              lazy={lazyRoute(() => import('@app/routes/game/craft/route'))}
              handle={scene(
                { id: 'craft', label: '造物仙炉', group: 'craft' },
                '【造物仙炉】',
              )}
            />
            <Route
              path="craft/refine"
              lazy={lazyRoute(
                () => import('@app/routes/game/craft/refine/route'),
              )}
              handle={scene(
                { id: 'refine', label: '炼器室', group: 'craft' },
                '【炼器室】',
              )}
            />
            <Route
              path="enlightenment"
              lazy={lazyRoute(() => import('@app/routes/game/enlightenment/route'))}
              handle={scene(
                { id: 'enlightenment', label: '藏经阁', group: 'cultivation' },
                '【藏经阁】',
              )}
            />
            <Route
              path="enlightenment/gongfa"
              lazy={lazyRoute(
                () => import('@app/routes/game/enlightenment/gongfa/route'),
              )}
              handle={scene(
                {
                  id: 'gongfa-enlightenment',
                  label: '功法参悟',
                  group: 'cultivation',
                },
                '【功法参悟】',
              )}
            />
            <Route
              path="enlightenment/manual-draw"
              lazy={lazyRoute(
                () => import('@app/routes/game/enlightenment/manual-draw/route'),
              )}
              handle={scene(
                { id: 'manual-draw', label: '问法寻卷', group: 'cultivation' },
                '问法寻卷',
              )}
            />
            <Route
              path="enlightenment/replace"
              lazy={lazyRoute(
                () => import('@app/routes/game/enlightenment/replace/route'),
              )}
              handle={scene(
                {
                  id: 'enlightenment-replace',
                  label: '参悟抉择',
                  group: 'cultivation',
                },
                '参悟抉择',
              )}
            />
            <Route
              path="enlightenment/skill"
              lazy={lazyRoute(
                () => import('@app/routes/game/enlightenment/skill/route'),
              )}
              handle={scene(
                {
                  id: 'skill-enlightenment',
                  label: '神通推演',
                  group: 'cultivation',
                },
                '【神通推演】',
              )}
            />
            <Route
              path="fate-reshape"
              lazy={lazyRoute(() => import('@app/routes/game/fate-reshape/route'))}
              handle={scene(
                { id: 'fate-reshape', label: '重塑命格', group: 'cultivation' },
                '重塑命格',
              )}
            />
            <Route
              path="market/recycle"
              lazy={lazyRoute(
                () => import('@app/routes/game/market/recycle/route'),
              )}
              handle={scene(
                { id: 'market-recycle', label: '坊市鉴宝', group: 'trade' },
                '坊市鉴宝',
              )}
            />
            <Route
              path="auction"
              lazy={lazyRoute(() => import('@app/routes/game/auction/route'))}
              handle={scene(
                { id: 'auction', label: '拍卖行', group: 'trade' },
                '拍卖行',
              )}
            />
            <Route
              path="battle/history"
              lazy={lazyRoute(
                () => import('@app/routes/game/battle/history/route'),
              )}
              handle={scene(
                { id: 'battle-history', label: '全部战绩', group: 'service' },
                '【全部战绩】',
              )}
            />
            <Route
              path="rankings"
              lazy={lazyRoute(() => import('@app/routes/game/rankings/route'))}
              handle={scene(
                { id: 'rankings', label: '天骄榜', group: 'travel' },
                '天骄榜',
              )}
            />
            <Route
              path="dungeon/history"
              lazy={lazyRoute(
                () => import('@app/routes/game/dungeon/history/route'),
              )}
              handle={scene(
                { id: 'dungeon-history', label: '探险札记', group: 'service' },
                '探险札记',
              )}
            />
            <Route
              path="world-chat"
              lazy={lazyRoute(() => import('@app/routes/game/world-chat/route'))}
              handle={scene(
                { id: 'world-chat', label: '世界传音', group: 'service' },
                '世界传音',
              )}
            />
            <Route
              path="community"
              lazy={lazyRoute(() => import('@app/routes/game/community/route'))}
              handle={scene(
                { id: 'community', label: '玩家交流群', group: 'service' },
                '玩家交流群',
              )}
            />
            <Route
              path="redeem"
              lazy={lazyRoute(() => import('@app/routes/game/redeem/route'))}
              handle={scene(
                { id: 'redeem', label: '兑换码', group: 'service' },
                '兑换码',
              )}
            />
            <Route
              path="settings/feedback"
              lazy={lazyRoute(
                () => import('@app/routes/game/settings/feedback/route'),
              )}
              handle={scene(
                { id: 'feedback', label: '意见反馈', group: 'service' },
                '意见反馈',
              )}
            />
          </Route>

          <Route element={<GameCombatLayout />}>
            <Route
              path="battle"
              lazy={lazyRoute(() => import('@app/routes/game/battle/route'))}
              handle={scene(
                {
                  id: 'battle',
                  label: '对战播报',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '对战播报',
              )}
            />
            <Route
              path="battle/challenge"
              lazy={lazyRoute(
                () => import('@app/routes/game/battle/challenge/route'),
              )}
              handle={scene(
                {
                  id: 'battle-challenge',
                  label: '挑战天骄',
                  group: 'travel',
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
                  label: '战斗回放',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '战斗回放',
              )}
            />
            <Route
              path="bet-battle/challenge"
              lazy={lazyRoute(
                () => import('@app/routes/game/bet-battle/challenge/route'),
              )}
              handle={scene(
                {
                  id: 'bet-battle-challenge',
                  label: '赌战挑战',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '赌战挑战',
              )}
            />
            <Route
              path="training-room"
              lazy={lazyRoute(
                () => import('@app/routes/game/training-room/route'),
              )}
              handle={scene(
                {
                  id: 'training-room',
                  label: '练功房',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '练功房',
              )}
            />
          </Route>

          <Route element={<GameArenaLayout />}>
            <Route
              path="bet-battle"
              lazy={lazyRoute(() => import('@app/routes/game/bet-battle/route'))}
              handle={scene(
                {
                  id: 'bet-battle',
                  label: '赌战台',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '赌战台',
              )}
            />
          </Route>

          <Route element={<GameMapLayout />}>
            <Route
              path="map"
              lazy={lazyRoute(() => import('@app/routes/game/map/route'))}
              handle={scene(
                {
                  id: 'map',
                  label: '修仙界地图',
                  group: 'travel',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                mapTitle,
              )}
            />
          </Route>

          <Route
            path="dungeon"
            lazy={lazyRoute(() => import('@app/routes/game/dungeon/route'))}
            handle={scene(
              {
                id: 'dungeon',
                label: '云游探秘',
                group: 'travel',
                chrome: 'immersive',
                dock: 'hidden',
              },
              '云游探秘',
            )}
          />
        </Route>
      </Route>

      <Route
        path="/admin"
        loader={requireAdminLoader}
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
          path="broadcast/email"
          lazy={lazyRoute(() => import('@app/routes/admin/broadcast/email/route'))}
          handle={title('邮箱群发')}
        />
        <Route
          path="broadcast/game-mail"
          lazy={lazyRoute(
            () => import('@app/routes/admin/broadcast/game-mail/route'),
          )}
          handle={title('游戏邮件')}
        />
        <Route
          path="templates"
          lazy={lazyRoute(() => import('@app/routes/admin/templates/route'))}
          handle={title('模板中心')}
        />
        <Route
          path="templates/new"
          lazy={lazyRoute(() => import('@app/routes/admin/templates/new/route'))}
          handle={title('新建模板')}
        />
        <Route
          path="templates/:id"
          lazy={lazyRoute(() => import('@app/routes/admin/templates/detail/route'))}
          handle={title('模板详情')}
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
          path="community-qrcode"
          lazy={lazyRoute(() => import('@app/routes/admin/community-qrcode/route'))}
          handle={title('交流群二维码')}
        />
      </Route>

      <Route
        path="*"
        lazy={lazyRoute(() => import('@app/routes/not-found'))}
        handle={title('缘分未至')}
      />
    </Route>,
  ),
);
