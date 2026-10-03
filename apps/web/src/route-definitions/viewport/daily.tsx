import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const dailyRoutes = [
  <Route
    path="inventory"
    lazy={lazyRoute(() => import('@app/routes/game/inventory/InventoryV6'))}
    handle={scene(
      {
        id: 'inventory',
        presentation: 'service',
        summary: '查看随身物品，穿戴道装或转存至洞府储藏室。',
      },
      '储物袋',
    )}
  />,
  <Route
    path="cave/storage"
    lazy={lazyRoute(() => import('@app/routes/game/inventory/route'))}
    handle={scene(
      {
        id: 'legacy-storage',
        presentation: 'service',
        summary: '收藏洞府旧物，取出灵材与丹药放入储物袋。',
      },
      '洞府宝库',
    )}
  />,
  <Route
    path="cave/storage/new"
    lazy={lazyRoute(() => import('@app/routes/game/inventory/InventoryV6'))}
    handle={scene(
      {
        id: 'storage',
        presentation: 'service',
        summary: '存放暂时不带在身上的物品。',
      },
      '洞府储藏室',
    )}
  />,
  <Route
    path="craft/alchemy"
    lazy={lazyRoute(() => import('@app/routes/game/craft/alchemy/route'))}
    handle={scene(
      {
        id: 'alchemy',
        summary: '选好药材与丹方，在这里炼制丹药。',
      },
      '【炼丹房】',
    )}
  />,
  <Route
    path="market"
    lazy={lazyRoute(() => import('@app/routes/game/market/route'))}
    handle={scene(
      {
        id: 'market',
        presentation: 'hub',
        summary: '购买物资，或把闲置物品换成灵石。',
      },
      '修仙坊市',
    )}
  />,
  <Route
    path="black-market"
    lazy={lazyRoute(() => import('@app/routes/game/black-market/route'))}
    handle={scene(
      {
        id: 'black-market',
        presentation: 'workflow',
        summary: '查看货物与线索，再决定是否交易。',
      },
      '暗巷黑市',
    )}
  />,
  <Route
    path="mail"
    lazy={lazyRoute(() => import('@app/routes/game/mail/route'))}
    handle={scene(
      {
        id: 'mail',
        presentation: 'service',
        summary: '查看传音玉简、领取附件，也可联系好友。',
      },
      '道友传音',
    )}
  />,
  <Route
    path="tower"
    lazy={lazyRoute(() => import('@app/routes/game/tower/route'))}
    handle={scene(
      {
        id: 'tower',
        summary: '蜃气每周聚作一境。先应眼前幻影，再看名号能留到第几重。',
      },
      '蜃楼幻境',
    )}
  />,
  <Route
    path="retreat"
    lazy={lazyRoute(() => import('@app/routes/game/retreat/route'))}
    handle={scene(
      {
        id: 'retreat',
        summary: '在静室闭关修炼，准备好后可尝试冲关。',
      },
      '静室修行',
    )}
  />,
  <Route
    path="divination"
    lazy={lazyRoute(() => import('@app/routes/game/divination/route'))}
    handle={scene({ id: 'divination', presentation: 'workflow' }, '每日占卜')}
  />,
  <Route
    path="inn"
    lazy={lazyRoute(() => import('@app/routes/game/inn/route'))}
    handle={scene(
      {
        id: 'inn',
        presentation: 'service',
        summary: '在灵眼之泉疗伤，查看疗伤所需的代价。',
      },
      '灵眼之泉',
    )}
  />,
  <Route
    path="tasks"
    lazy={lazyRoute(() => import('@app/routes/game/tasks/route'))}
    handle={scene(
      {
        id: 'tasks',
        presentation: 'archive',
        summary: '查看破境任务和试炼进度。宗门任务请到宗门事务中查看。',
      },
      '任务中心',
    )}
  />,
  <Route
    path="skills"
    lazy={lazyRoute(() => import('@app/routes/game/skills/route'))}
    handle={scene(
      {
        id: 'skills',
        presentation: 'archive',
        summary: '旧日诸术归卷，留存往昔修行记录。',
      },
      '【所修神通】',
    )}
  />,
];
