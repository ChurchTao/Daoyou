import { lazyRoute } from '@app/lib/router/lazyRoute';
import { Route } from 'react-router';
import { scene } from '../handles';

export const characterRoutes = [
  <Route
    index
    lazy={lazyRoute(() => import('@app/routes/game/route'))}
    handle={scene(
      {
        id: 'cave',
        presentation: 'hub',
        summary: '石门半掩，纸窗透白。丹火、经卷、器架与玉简都安放在各自的位置',
      },
      '洞府',
    )}
  />,
  <Route
    path="cultivator"
    lazy={lazyRoute(() => import('@app/routes/game/cultivator/route'))}
    handle={scene(
      {
        id: 'cultivator',
        presentation: 'archive',
        summary: '查看道身状态、属性和修行进度。',
      },
      '道身',
    )}
  />,
  <Route
    path="cultivator/attributes"
    lazy={lazyRoute(
      () => import('@app/routes/game/cultivator/attributes/route'),
    )}
    handle={scene(
      {
        id: 'cultivator-attributes',
        presentation: 'archive',
        summary: '查看角色属性，分配尚未使用的属性点。',
      },
      '根基属性',
    )}
  />,
  <Route
    path="spirit-field"
    lazy={lazyRoute(() => import('@app/routes/game/spirit-field/route'))}
    handle={scene(
      {
        id: 'spirit-field',
        presentation: 'workflow',
        summary: '播下灵种，培育成熟后收获灵草。',
      },
      '洞府灵田',
    )}
  />,
  <Route
    path="body-cultivation"
    lazy={lazyRoute(() => import('@app/routes/game/body-cultivation/route'))}
    handle={scene(
      {
        id: 'body-cultivation',
        summary: '查看五轨炼体进度、当前收益和升阶条件。',
      },
      '肉身炼体',
    )}
  />,
  <Route
    path="body-cultivation/breakthrough"
    lazy={lazyRoute(
      () => import('@app/routes/game/body-cultivation/breakthrough/route'),
    )}
    handle={scene(
      {
        id: 'body-cultivation',
        summary: '核对升阶条件和消耗，准备肉身升阶。',
      },
      '肉身升阶',
    )}
  />,
  <Route
    path="marrow-wash"
    lazy={lazyRoute(() => import('@app/routes/game/marrow-wash/route'))}
    handle={scene(
      {
        id: 'marrow-wash',
        summary: '查看洗髓进度、属性点和后天灵根加成。',
      },
      '洗髓池',
    )}
  />,
];
