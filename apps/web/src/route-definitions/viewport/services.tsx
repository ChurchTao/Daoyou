import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const servicesRoutes = [
  <Route
    path="market/recycle"
    lazy={lazyRoute(() => import('@app/routes/game/market/recycle/route'))}
    handle={scene(
      {
        id: 'market-recycle',
        summary: '查看物品估价，确认后换取灵石。',
      },
      '坊市鉴宝',
    )}
  />,
  <Route
    path="tianjiao-vault"
    lazy={lazyRoute(() => import('@app/routes/game/tianjiao-vault/route'))}
    handle={scene(
      {
        id: 'tianjiao-vault',
        presentation: 'service',
        summary: '凭声望换取万界商行珍藏。',
      },
      '万界商行',
    )}
  />,
  <Route
    path="auction"
    lazy={lazyRoute(() => import('@app/routes/game/auction/route'))}
    handle={scene(
      {
        id: 'auction',
        presentation: 'service',
        summary: '珍材、道装与灵兽在此寄售，成交后由传音送达。',
      },
      '拍卖行',
    )}
  />,
  <Route
    path="battle/history"
    lazy={lazyRoute(() => import('@app/routes/game/battle/history/route'))}
    handle={scene(
      {
        id: 'battle-history',
        presentation: 'archive',
        summary: '翻阅天骄榜与擂台战绩，回看斗法交锋。',
      },
      '【全部战绩】',
    )}
  />,
  <Route
    path="journal"
    lazy={lazyRoute(() => import('@app/routes/game/journal/route'))}
    handle={scene(
      {
        id: 'journal',
        presentation: 'archive',
        summary: '翻阅道具、修为、感悟与各类货币的得失。',
      },
      '修仙日志',
    )}
  />,
  <Route
    path="rankings"
    lazy={lazyRoute(() => import('@app/routes/game/rankings/route'))}
    handle={scene(
      {
        id: 'rankings',
        presentation: 'service',
        summary: '查看榜单名次与奖励，选择对手发起挑战。',
      },
      '天骄榜',
    )}
  />,
  <Route
    path="beast-room"
    lazy={lazyRoute(() => import('@app/routes/game/beast-room/route'))}
    handle={scene(
      {
        id: 'beast-room',
        presentation: 'hub',
        summary: '照料灵兽，翻阅图录，或引两灵相合、孕育新生。',
      },
      '育兽室',
    )}
  />,
  <Route
    path="beasts"
    lazy={lazyRoute(() => import('@app/routes/game/beasts/route'))}
    handle={scene(
      {
        id: 'beasts',
        presentation: 'workflow',
        summary: '与灵兽结缘，携带出战或安心休养。',
      },
      '灵兽袋',
    )}
  />,
  <Route
    path="beasts/codex"
    lazy={lazyRoute(() => import('@app/routes/game/beasts/codex/route'))}
    handle={scene(
      {
        id: 'beast-codex',
        presentation: 'workflow',
        summary: '查阅资质、技能与出没之地。',
      },
      '灵兽图鉴',
    )}
  />,
  <Route
    path="beasts/fusion"
    lazy={lazyRoute(() => import('@app/routes/game/beasts/fusion/route'))}
    handle={scene(
      {
        id: 'beast-fusion',
        presentation: 'workflow',
        summary: '选择两只灵兽，查看融合结果与消耗。',
      },
      '灵兽融合',
    )}
  />,
  <Route
    path="arena"
    lazy={lazyRoute(() => import('@app/routes/game/arena/route'))}
    handle={scene(
      {
        id: 'arena-sparring',
        presentation: 'workflow',
        summary: '创建房间或凭邀请码入场，自动分队后进行无消耗切磋。',
      },
      '擂台切磋',
    )}
  />,
  <Route
    path="dungeon/history"
    lazy={lazyRoute(() => import('@app/routes/game/dungeon/history/route'))}
    handle={scene(
      {
        id: 'dungeon-history',
        presentation: 'archive',
        summary: '查看已完成的探索和收获记录。',
      },
      '探险札记',
    )}
  />,
  <Route
    path="world-chat"
    lazy={lazyRoute(() => import('@app/routes/game/world-chat/route'))}
    handle={scene(
      {
        id: 'world-chat',
        presentation: 'service',
        summary: '诸界闲谈与即时传音都在此处。',
      },
      '世界传音',
    )}
  />,
  <Route
    path="community"
    lazy={lazyRoute(() => import('@app/routes/game/community/route'))}
    handle={scene(
      {
        id: 'community',
        presentation: 'service',
        summary: '复制群号，在 QQ 搜索并申请入群。',
      },
      '玩家交流群',
    )}
  />,
  <Route
    path="redeem"
    lazy={lazyRoute(() => import('@app/routes/game/redeem/route'))}
    handle={scene(
      {
        id: 'redeem',
        presentation: 'service',
        summary: '输入兑换码，奖励会通过传音玉简送达。',
      },
      '兑换码',
    )}
  />,
  <Route
    path="merit-ledger"
    lazy={lazyRoute(() => import('@app/routes/game/merit-ledger/route'))}
    handle={scene(
      {
        id: 'merit-ledger',
        presentation: 'service',
        summary: '记同行之缘，不录金额与次数。',
      },
      '功德簿',
    )}
  />,
  <Route
    path="settings"
    lazy={lazyRoute(() => import('@app/routes/game/settings/route'))}
    handle={scene(
      {
        id: 'settings',
        presentation: 'service',
        summary: '管理角色、账号与模型配置。',
      },
      '系统设置',
    )}
  />,
  <Route
    path="settings/feedback"
    lazy={lazyRoute(() => import('@app/routes/game/settings/feedback/route'))}
    handle={scene(
      {
        id: 'feedback',
        presentation: 'service',
        summary: '遇到问题或有改进建议，可以在这里告诉我们。',
      },
      '意见反馈',
    )}
  />,
];
