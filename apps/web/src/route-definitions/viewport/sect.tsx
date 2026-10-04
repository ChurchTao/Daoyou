import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const sectRoutes = [
  <Route
    path="sect"
    lazy={lazyRoute(() => import('@app/routes/game/sect/route'))}
    handle={scene(
      {
        id: 'sect',
        summary: '拜访诸宗、研习心法、选择流派并承接宗门委托。',
      },
      '宗门',
    )}
  />,
  <Route
    path="sect/abilities"
    lazy={lazyRoute(() => import('@app/routes/game/sect/abilities/redirect'))}
    handle={scene(
      {
        id: 'sect-abilities',
        presentation: 'workflow',
        summary: '旧宗门神通入口将迁往宗门演武场。',
      },
      '宗门演武',
    )}
  />,
  <Route
    path="sect/transfer"
    lazy={lazyRoute(() => import('@app/routes/game/sect/transfer/route'))}
    handle={scene(
      {
        id: 'sect-transfer',
        presentation: 'workflow',
        summary: '使用欺天符，查看并确认无损转宗。',
      },
      '欺天台 · 转宗',
    )}
  />,
  <Route
    path="sect/hall"
    lazy={lazyRoute(() => import('@app/routes/game/sect/hall/route'))}
    handle={scene(
      {
        id: 'sect-hall',
        presentation: 'archive',
        summary: '查看宗门身份、晋升条件、周俸和同门名录。',
      },
      '宗门大殿',
    )}
  />,
  <Route
    path="sect/affairs"
    lazy={lazyRoute(() => import('@app/routes/game/sect/affairs/route'))}
    handle={scene(
      {
        id: 'sect-affairs',
        summary: '领取宗门日常、周常、悬赏和晋升试炼。',
      },
      '宗门事务',
    )}
  />,
  <Route
    path="sect/archive"
    lazy={lazyRoute(() => import('@app/routes/game/sect/archive/route'))}
    handle={scene(
      {
        id: 'sect-archive',
        presentation: 'workflow',
        summary: '宗门心法依次归档，研习受境界、职阶与设施等级共同约束。',
      },
      '宗门传承',
    )}
  />,
  <Route
    path="sect/archive/methods"
    lazy={lazyRoute(
      () => import('@app/routes/game/sect/archive/methods/route'),
    )}
    handle={scene(
      {
        id: 'sect-archive',
        presentation: 'workflow',
        summary: '旧心法入口将归入宗门传承场所。',
      },
      '宗门传承',
    )}
  />,
  <Route
    path="sect/archive/paths"
    lazy={lazyRoute(() => import('@app/routes/game/sect/archive/paths/route'))}
    handle={scene(
      {
        id: 'sect-enlightenment-cliff',
        presentation: 'workflow',
        summary: '旧流派入口将迁往宗门悟道场所。',
      },
      '宗门悟道',
    )}
  />,
  <Route
    path="sect/archive/abilities"
    lazy={lazyRoute(
      () => import('@app/routes/game/sect/archive/abilities/route'),
    )}
    handle={scene(
      {
        id: 'sect-abilities',
        presentation: 'workflow',
        summary: '旧神通入口将迁往宗门演武场。',
      },
      '宗门演武',
    )}
  />,
  <Route
    path="sect/enlightenment-cliff"
    lazy={lazyRoute(
      () => import('@app/routes/game/sect/enlightenment-cliff/route'),
    )}
    handle={scene(
      {
        id: 'sect-enlightenment-cliff',
        presentation: 'workflow',
        summary: '选择流派与参悟节点，查看当前构筑。',
      },
      '宗门悟道',
    )}
  />,
  <Route
    path="sect/arena"
    lazy={lazyRoute(() => import('@app/routes/game/sect/arena/route'))}
    handle={scene(
      {
        id: 'sect-abilities',
        presentation: 'workflow',
        summary: '配置宗门神通与自动战术。',
      },
      '宗门演武',
    )}
  />,
  <Route
    path="sect/treasury"
    lazy={lazyRoute(() => import('@app/routes/game/sect/treasury/route'))}
    handle={scene(
      {
        id: 'sect-treasury',
        presentation: 'service',
        summary: '使用宗门贡献兑换物资，部分物品受职阶限制。',
      },
      '宗门宝库',
    )}
  />,
  <Route
    path="sect/industries"
    lazy={lazyRoute(() => import('@app/routes/game/sect/industries/route'))}
    handle={scene(
      {
        id: 'sect-industries',
        presentation: 'archive',
        summary: '查看宗门设施、公共工程和建设捐献记录。',
      },
      '宗门建设',
    )}
  />,
  <Route
    path="sect/cultivation-room"
    lazy={lazyRoute(
      () => import('@app/routes/game/sect/cultivation-room/route'),
    )}
    handle={scene(
      {
        id: 'sect-cultivation-room',
        summary: '宗门聚灵阵为现有闭关结算提供修为加成。',
      },
      '宗门修炼室',
    )}
  />,
  <Route
    path="sect/workshop"
    lazy={lazyRoute(() => import('@app/routes/game/sect/workshop/route'))}
    handle={scene(
      {
        id: 'sect',
        presentation: 'hub',
        summary: '旧丹器坊入口将返回宗门总视图。',
      },
      '宗门',
    )}
  />,
  <Route
    path="sect/alchemy"
    lazy={lazyRoute(() => import('@app/routes/game/sect/alchemy/route'))}
    handle={scene(
      {
        id: 'sect-alchemy',
        presentation: 'workflow',
        summary: '借宗门丹火完成即兴炼丹与丹方炼制。',
      },
      '宗门丹房',
    )}
  />,
  <Route
    path="sect/refinery"
    lazy={lazyRoute(() => import('@app/routes/game/sect/refinery/route'))}
    handle={scene(
      {
        id: 'sect-refinery',
        presentation: 'workflow',
        summary: '借宗门地火锻造法宝。',
      },
      '宗门器坊',
    )}
  />,
  <Route
    path="sect/spirit-vein"
    lazy={lazyRoute(() => import('@app/routes/game/sect/spirit-vein/route'))}
    handle={scene(
      {
        id: 'sect-spirit-vein',
        presentation: 'service',
        summary: '查看灵脉设施等级与灵石俸禄加成。',
      },
      '宗门灵脉',
    )}
  />,
  <Route
    path="sect/herb-garden"
    lazy={lazyRoute(() => import('@app/routes/game/sect/herb-garden/route'))}
    handle={scene(
      {
        id: 'sect-herb-garden',
        presentation: 'service',
        summary: '查看药田等级、每周灵草产出与灵植长势。',
      },
      '宗门药田',
    )}
  />,
  <Route
    path="sect/cave"
    lazy={lazyRoute(() => import('@app/routes/game/sect/cave/route'))}
    handle={scene(
      {
        id: 'sect-cave',
        summary: '查看弟子在宗门中的个人居所资格。',
      },
      '弟子居所',
    )}
  />,
  <Route
    path="sect/gate"
    lazy={lazyRoute(() => import('@app/routes/game/sect/gate/route'))}
    handle={scene(
      {
        id: 'sect-gate',
        presentation: 'service',
        summary: '宗门动态与未来拜师入口归于山门。',
      },
      '宗门山门',
    )}
  />,
];
