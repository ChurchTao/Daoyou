# 统一图标

灵兽头像的美术方向、固定参考、生成与视觉验收见 [写意墨像技能](../.agents/skills/daoyou-ink-portraits/SKILL.md)。本文负责渲染和资源管理约定。

React 图标入口为 `src/react-app/components/ui/GameIcon.tsx`。普通字符串直接显示（主要用于 emoji）；`icon:名称` 只查询集中注册的 SVG／WebP／PNG 图片，不拼接路径、不加载远程地址、不注入 SVG 字符串。未知名称和空值显示 `❔`。

```tsx
<GameIcon value="🦊" />
<GameIcon value="icon:beast-silverwing-mantis" className="text-5xl" />
<GameIcon value="icon:beast-thunder-peng" label="雷鹏" />
```

图标默认一 em 见方，通过字号控制大小，图片保持原始比例。默认作为装饰对读屏隐藏；单独表达含义时传 `label`，旁边已有名称时省略。颜色来自素材本身，以保证物种辨识度。

## 新增与使用

1. 图标文件统一放进 `public/assets/icons/`。头像优先使用 256×256 透明 WebP；灵兽头像裁掉透明外边距后等比贴合，宽或高一边尽量占满画布，另一边居中，保留完整轮廓和内部留白。简洁图形可用 SVG，也支持 PNG。检查小尺寸轮廓与透明边缘；SVG 采用正方形 viewBox，禁用脚本、外链和 foreignObject。
2. 在 `src/react-app/components/ui/icons/registry.ts` 显式注册稳定名称及 `/assets/icons/文件名` 静态路径，业务配置填写 `icon:名称`。名称按类别加前缀，例如 `beast-`。
3. 调用方只使用 `GameIcon`；不自行解析协议、不直接引用资源、不创建第二份注册表。删除或更名时同时检索配置引用。
4. 业务适配组件只负责从领域 ID 取图标值，例如共享的 `feature/beasts/BeastIcon.tsx`，渲染始终交给 `GameIcon`。

初始灵兽选择、灵兽名册与详情头像统一通过 `BeastIcon` 渲染。新增或改动图标使用同一入口；灵兽头像的当前写意墨像素材见 [生成记录](beast-avatar-generation.md)。

静态文件随 Vite 构建复制到 `dist/assets/icons/`。新增或替换后检查注册路径与部署产物；同名图标更新素材时可给文件名添加版本号并更新注册路径，业务图标名称不变，避免旧缓存。

Phaser 等 Canvas 渲染器通过 `GameIcon.resolveSource(iconValue)` 获取同一注册资源，再交给纹理加载器；协议解析仍由 `GameIcon.tsx` 集中处理，业务侧不拼接图标路径。新版地图的五类单一用途节点、筛选项和详情共用这一套透明 WebP 资源。

地图图标使用图片生成的国画彩墨素材区分灵兽、秘境石门、坊市摊亭、宗门山门与山川地标。母版按网格分割、透明边界裁切和统一留边后交付为 160×160 RGBA 无损 WebP；区域地图使用左侧大徽头、右侧细胶囊的一体标签：图标固定在左侧，常规显示 40px，秘境菱徽内为 32px；徽头最小高度 52px，文字胶囊比徽头低 16px。灵兽采用苔绿圆徽、秘境采用烟紫菱徽、坊市采用赭金圆角方徽、宗门采用青碧六角徽、山川采用石青拱徽。徽头和文字底均不透明，选中统一使用朱砂描边；密集处保留类别徽头，悬停或选中展开名称。


| 素材 | 用途 | 规格 | 接入 |
| --- | --- | --- | --- |
| `public/assets/icons/map-wild.webp` | 灵兽出没地 | 160×160，RGBA | 地图、筛选、查找、详情 |
| `public/assets/icons/map-dungeon.webp` | 秘境 | 160×160，RGBA | 地图、筛选、查找、详情 |
| `public/assets/icons/map-market.webp` | 坊市 | 160×160，RGBA | 地图、筛选、查找、详情 |
| `public/assets/icons/map-sect.webp` | 宗门 | 160×160，RGBA | 地图、筛选、查找、详情 |
| `public/assets/icons/map-landmark.webp` | 山川地标 | 160×160，RGBA | 地图、筛选、查找、详情 |
