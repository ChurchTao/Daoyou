# 统一图标

灵兽头像的美术方向、固定参考、生成与视觉验收见 [灵兽头像技能](../.agents/skills/daoyou-beast-avatars/SKILL.md)。本文负责渲染和资源管理约定。

React 图标入口为 `src/react-app/components/ui/GameIcon.tsx`。普通字符串直接显示（主要用于 emoji）；`icon:名称` 只查询集中注册的 SVG／WebP／PNG 图片，不拼接路径、不加载远程地址、不注入 SVG 字符串。未知名称和空值显示 `❔`。

```tsx
<GameIcon value="🦊" />
<GameIcon value="icon:beast-silverwing-mantis" className="text-5xl" />
<GameIcon value="icon:beast-thunder-peng" label="雷鹏" />
```

图标默认一 em 见方，通过字号控制大小，图片保持原始比例。默认作为装饰对读屏隐藏；单独表达含义时传 `label`，旁边已有名称时省略。颜色来自素材本身，以保证物种辨识度。

## 新增与使用

1. 图标文件统一放进 `public/assets/icons/`。头像优先使用 256×256 透明 WebP；简洁图形可用 SVG，也支持 PNG。检查小尺寸轮廓与透明边缘；SVG 采用正方形 viewBox，禁用脚本、外链和 foreignObject。
2. 在 `src/react-app/components/ui/icons/registry.ts` 显式注册稳定名称及 `/assets/icons/文件名` 静态路径，业务配置填写 `icon:名称`。名称按类别加前缀，例如 `beast-`。
3. 调用方只使用 `GameIcon`；不自行解析协议、不直接引用资源、不创建第二份注册表。删除或更名时同时检索配置引用。
4. 业务适配组件只负责从领域 ID 取图标值，例如共享的 `feature/beasts/BeastIcon.tsx`，渲染始终交给 `GameIcon`。

本轮迁移初始灵兽选择、兽栏列表及详情头像。七种保留动物 emoji；火翎鸦、雪翎鹤、月影貂、墨蛟、银翅螳螂、六目灵猿、冥灯蝶和雷鹏使用 256×256 透明 WebP。雷鹏沿用 A 版侧脸头像，其余七种参照同一基准生成，见 [生成记录](beast-avatar-generation.md)。技能图标和其他业务的既有图标留待各自迁移；新增或改动图标渲染应复用此入口。

静态文件随 Vite 构建复制到 `dist/assets/icons/`。新增或替换后检查注册路径与部署产物；同名图标更新素材时可给文件名添加版本号并更新注册路径，业务图标名称不变，避免旧缓存。
