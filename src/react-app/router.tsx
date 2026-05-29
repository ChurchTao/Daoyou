import App, { RootRouteErrorBoundary } from '@app/App';
import { getGameSceneMeta } from '@app/components/game-shell/gameNavigation';
import {
  GameCombatLayout,
  GameDungeonLayout,
  GameGenesisLayout,
  GameMapLayout,
  GameViewportLayout,
  PlayerProviderLayout,
} from '@app/layouts/game-layout';
import { lazyRoute } from '@app/lib/router/lazyRoute';
import { AUTH_LAYOUT_ROUTE_ID, GAME_ROUTE_ID } from '@app/lib/router/routeData';
import type {
  AppRouteHandle,
  GameSceneHandle,
  RouteTitleResolver,
} from '@app/lib/router/routeTitle';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router';

const title = (value: RouteTitleResolver): AppRouteHandle => ({ title: value });
const scene = (
  sceneHandle: Pick<GameSceneHandle, 'id'> &
    Partial<
      Pick<GameSceneHandle, 'chrome' | 'dock' | 'presentation' | 'summary'>
    >,
  value: RouteTitleResolver,
): AppRouteHandle => {
  const chrome = sceneHandle.chrome ?? 'standard';
  const meta = getGameSceneMeta(sceneHandle.id);

  if (!meta) {
    throw new Error(`Missing game scene metadata for "${sceneHandle.id}"`);
  }

  return {
    title: value,
    gameScene: {
      id: meta.id,
      label: meta.label,
      group: meta.group,
      chrome,
      dock: sceneHandle.dock ?? 'core',
      presentation:
        sceneHandle.presentation ??
        (chrome === 'immersive' ? 'immersive' : 'workflow'),
      summary: sceneHandle.summary ?? null,
    },
  };
};

const mapTitle: RouteTitleResolver = ({ searchParams }) =>
  searchParams.get('intent') === 'market'
    ? '修仙界地图 · 坊市选址'
    : '修仙界地图 · 历练选址';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<App />} errorElement={<RootRouteErrorBoundary />}>
      <Route index lazy={lazyRoute(() => import('@app/routes/index/route'))} />

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
      <Route
        id={GAME_ROUTE_ID}
        path="/game"
        lazy={lazyRoute(() => import('@app/routes/game/layout'))}
      >
        <Route element={<GameGenesisLayout />}>
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
        </Route>

        <Route element={<PlayerProviderLayout />}>
          <Route element={<GameViewportLayout />}>
            <Route
              index
              lazy={lazyRoute(() => import('@app/routes/game/route'))}
              handle={scene(
                {
                  id: 'cave',
                  presentation: 'hub',
                  summary:
                    '石门半掩，纸窗透白。丹火、经卷、器架与玉简都安放在各自的位置',
                },
                '洞府',
              )}
            />
            <Route
              path="cultivator"
              lazy={lazyRoute(
                () => import('@app/routes/game/cultivator/route'),
              )}
              handle={scene(
                {
                  id: 'cultivator',
                  presentation: 'archive',
                  summary: '名号、命格、根基与所修皆在此归卷。',
                },
                '道身',
              )}
            />
            <Route
              path="inventory"
              lazy={lazyRoute(() => import('@app/routes/game/inventory/route'))}
              handle={scene(
                {
                  id: 'inventory',
                  presentation: 'service',
                  summary: '点清身边诸物，再决定去留流转。',
                },
                '储物袋',
              )}
            />
            <Route
              path="craft/alchemy"
              lazy={lazyRoute(
                () => import('@app/routes/game/craft/alchemy/route'),
              )}
              handle={scene(
                {
                  id: 'alchemy',
                  summary: '看药材、控炉候、炼丹息身。',
                },
                '【炼丹房】',
              )}
            />
            <Route
              path="market"
              lazy={lazyRoute(() => import('@app/routes/game/market/route'))}
              handle={scene(
                {
                  id: 'market',
                  presentation: 'hub',
                  summary: '买卖流转与鉴宝收材皆由此起。',
                },
                '修仙坊市',
              )}
            />
            <Route
              path="mail"
              lazy={lazyRoute(() => import('@app/routes/game/mail/route'))}
              handle={scene(
                {
                  id: 'mail',
                  presentation: 'service',
                  summary: '宗门来函与诸界消息尽归玉简。',
                },
                '传音玉简',
              )}
            />
            <Route
              path="tower"
              lazy={lazyRoute(() => import('@app/routes/game/tower/route'))}
              handle={scene(
                {
                  id: 'tower',
                  summary:
                    '蜃气每周聚作一境。先应眼前幻影，再看名号能留到第几重。',
                },
                '蜃楼幻境',
              )}
            />
            <Route
              path="retreat"
              lazy={lazyRoute(() => import('@app/routes/game/retreat/route'))}
              handle={scene(
                {
                  id: 'retreat',
                  summary: '闭关、冲关与寿元筹算都在静室。',
                },
                '静室修行',
              )}
            />
            <Route
              path="inn"
              lazy={lazyRoute(() => import('@app/routes/game/inn/route'))}
              handle={scene(
                {
                  id: 'inn',
                  presentation: 'service',
                  summary: '付灵石养伤住店，稳住道体再续行。',
                },
                '客栈',
              )}
            />
            <Route
              path="tasks"
              lazy={lazyRoute(() => import('@app/routes/game/tasks/route'))}
              handle={scene(
                {
                  id: 'tasks',
                  presentation: 'archive',
                  summary: '当前破境前置、试炼进度与已完成任务都在此归卷。',
                },
                '任务中心',
              )}
            />
            <Route
              path="skills"
              lazy={lazyRoute(() => import('@app/routes/game/skills/route'))}
              handle={scene(
                {
                  id: 'skills',
                  presentation: 'archive',
                  summary: '已成诸术归卷，便于查阅与取舍。',
                },
                '【所修神通】',
              )}
            />
            <Route
              path="techniques"
              lazy={lazyRoute(
                () => import('@app/routes/game/techniques/route'),
              )}
              handle={scene(
                {
                  id: 'techniques',
                  presentation: 'archive',
                  summary: '功法道基在此归档，便于比照深浅。',
                },
                '【所修功法】',
              )}
            />
            <Route
              path="craft"
              lazy={lazyRoute(() => import('@app/routes/game/craft/route'))}
              handle={scene(
                {
                  id: 'craft',
                  presentation: 'hub',
                  summary: '分清炼器与炼丹，再携灵材入炉。',
                },
                '【造物仙炉】',
              )}
            />
            <Route
              path="craft/refine"
              lazy={lazyRoute(
                () => import('@app/routes/game/craft/refine/route'),
              )}
              handle={scene(
                {
                  id: 'refine',
                  summary: '铸器成兵，先校料再落锤火。',
                },
                '【炼器室】',
              )}
            />
            <Route
              path="enlightenment"
              lazy={lazyRoute(
                () => import('@app/routes/game/enlightenment/route'),
              )}
              handle={scene(
                {
                  id: 'enlightenment',
                  presentation: 'hub',
                  summary: '推演、求卷与取舍都归书案。',
                },
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
                  summary: '衡量悟性与投入，细推功法脉络。',
                },
                '【功法参悟】',
              )}
            />
            <Route
              path="enlightenment/manual-draw"
              lazy={lazyRoute(
                () =>
                  import('@app/routes/game/enlightenment/manual-draw/route'),
              )}
              handle={scene(
                {
                  id: 'manual-draw',
                  summary: '请符求卷，补足今日所缺法门。',
                },
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
                  summary: '新旧法门只在此处做一次取舍。',
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
                  summary: '排定材料与悟性，推演一门神通。',
                },
                '【神通推演】',
              )}
            />
            <Route
              path="fate-reshape"
              lazy={lazyRoute(
                () => import('@app/routes/game/fate-reshape/route'),
              )}
              handle={scene(
                {
                  id: 'fate-reshape',
                  summary: '拨动命数之前，先看当下格局。',
                },
                '重塑命格',
              )}
            />
            <Route
              path="market/recycle"
              lazy={lazyRoute(
                () => import('@app/routes/game/market/recycle/route'),
              )}
              handle={scene(
                {
                  id: 'market-recycle',
                  summary: '识别去留，批量回收冗余之物。',
                },
                '坊市鉴宝',
              )}
            />
            <Route
              path="auction"
              lazy={lazyRoute(() => import('@app/routes/game/auction/route'))}
              handle={scene(
                {
                  id: 'auction',
                  presentation: 'service',
                  summary: '观市、寄售与竞拍合为一案。',
                },
                '拍卖行',
              )}
            />
            <Route
              path="battle/history"
              lazy={lazyRoute(
                () => import('@app/routes/game/battle/history/route'),
              )}
              handle={scene(
                {
                  id: 'battle-history',
                  presentation: 'archive',
                  summary: '斗法卷宗与旧战回放在此归档。',
                },
                '【全部战绩】',
              )}
            />
            <Route
              path="rankings"
              lazy={lazyRoute(() => import('@app/routes/game/rankings/route'))}
              handle={scene(
                {
                  id: 'rankings',
                  presentation: 'service',
                  summary: '看榜、领赏、择敌挑战。',
                },
                '天骄榜',
              )}
            />
            <Route
              path="bet-battle"
              lazy={lazyRoute(
                () => import('@app/routes/game/bet-battle/route'),
              )}
              handle={scene(
                {
                  id: 'bet-battle',
                  summary: '设注、应战与结算皆在赌战台。',
                },
                '赌战台',
              )}
            />
            <Route
              path="dungeon/history"
              lazy={lazyRoute(
                () => import('@app/routes/game/dungeon/history/route'),
              )}
              handle={scene(
                {
                  id: 'dungeon-history',
                  presentation: 'archive',
                  summary: '一路遭逢与所得在此翻卷。',
                },
                '探险札记',
              )}
            />
            <Route
              path="world-chat"
              lazy={lazyRoute(
                () => import('@app/routes/game/world-chat/route'),
              )}
              handle={scene(
                {
                  id: 'world-chat',
                  presentation: 'service',
                  summary: '诸界闲谈与即时传音都在此处。',
                },
                '世界传音',
              )}
            />
            <Route
              path="community"
              lazy={lazyRoute(() => import('@app/routes/game/community/route'))}
              handle={scene(
                {
                  id: 'community',
                  presentation: 'service',
                  summary: '外部群聊入口与同道集散之处。',
                },
                '玩家交流群',
              )}
            />
            <Route
              path="redeem"
              lazy={lazyRoute(() => import('@app/routes/game/redeem/route'))}
              handle={scene(
                {
                  id: 'redeem',
                  presentation: 'service',
                  summary: '持契兑缘，所得会经玉简投递。',
                },
                '兑换码',
              )}
            />
            <Route
              path="settings/feedback"
              lazy={lazyRoute(
                () => import('@app/routes/game/settings/feedback/route'),
              )}
              handle={scene(
                {
                  id: 'feedback',
                  presentation: 'service',
                  summary: '把平衡与体验问题留在此处。',
                },
                '意见反馈',
              )}
            />
            <Route
              path="settings/llm-config"
              lazy={lazyRoute(
                () => import('@app/routes/game/settings/llm-config/route'),
              )}
              handle={scene(
                {
                  id: 'llm-config',
                  presentation: 'service',
                  summary: '配置你自己的 LLM Provider 与模型参数。',
                },
                '模型配置',
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
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '挑战天骄',
              )}
            />
            <Route
              path="battle/:id"
              lazy={lazyRoute(
                () => import('@app/routes/game/battle/detail/route'),
              )}
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
              lazy={lazyRoute(
                () => import('@app/routes/game/tower/battle/route'),
              )}
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
              path="bet-battle/challenge"
              lazy={lazyRoute(
                () => import('@app/routes/game/bet-battle/challenge/route'),
              )}
              handle={scene(
                {
                  id: 'bet-battle-challenge',
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
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '练功房',
              )}
            />
            <Route
              path="tasks/:taskId/challenge"
              lazy={lazyRoute(
                () => import('@app/routes/game/tasks/challenge/route'),
              )}
              handle={scene(
                {
                  id: 'task-challenge',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '破境试炼',
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
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                mapTitle,
              )}
            />
          </Route>

          <Route element={<GameDungeonLayout />}>
            <Route
              path="dungeon"
              lazy={lazyRoute(() => import('@app/routes/game/dungeon/route'))}
              handle={scene(
                {
                  id: 'dungeon',
                  chrome: 'immersive',
                  dock: 'hidden',
                },
                '云游探秘',
              )}
            />
          </Route>
        </Route>
      </Route>

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
          path="broadcast/email"
          lazy={lazyRoute(
            () => import('@app/routes/admin/broadcast/email/route'),
          )}
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
          path="announcement"
          lazy={lazyRoute(() => import('@app/routes/admin/announcement/route'))}
          handle={title('游戏公告')}
        />
        <Route
          path="templates"
          lazy={lazyRoute(() => import('@app/routes/admin/templates/route'))}
          handle={title('模板中心')}
        />
        <Route
          path="templates/new"
          lazy={lazyRoute(
            () => import('@app/routes/admin/templates/new/route'),
          )}
          handle={title('新建模板')}
        />
        <Route
          path="templates/:id"
          lazy={lazyRoute(
            () => import('@app/routes/admin/templates/detail/route'),
          )}
          handle={title('模板详情')}
        />
        <Route
          path="redeem-codes"
          lazy={lazyRoute(() => import('@app/routes/admin/redeem-codes/route'))}
          handle={title('兑换码管理')}
        />
        <Route
          path="redeem-codes/new"
          lazy={lazyRoute(
            () => import('@app/routes/admin/redeem-codes/new/route'),
          )}
          handle={title('新建兑换码')}
        />
        <Route
          path="llm-metrics"
          lazy={lazyRoute(() => import('@app/routes/admin/llm-metrics/route'))}
          handle={title('LLM 观测')}
        />
        <Route
          path="community-group"
          lazy={lazyRoute(
            () => import('@app/routes/admin/community-qrcode/route'),
          )}
          handle={title('QQ交流群')}
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
