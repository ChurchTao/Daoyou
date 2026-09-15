# 统一图标

React 图标入口为 `src/react-app/components/ui/GameIcon.tsx`。普通字符串直接显示（主要用于 emoji）；`icon:名称` 只查询集中注册的 SVG，不拼接路径、不加载远程地址、不注入 SVG 字符串。未知名称和空值显示 `❔`。

```tsx
<GameIcon value="🦊" />
<GameIcon value="icon:beast-silverwing-mantis" className="text-5xl" />
<GameIcon value="icon:beast-snow-crane" label="雪翎鹤" />
```

图标默认一 em 见方，通过字号控制大小。默认作为装饰对读屏隐藏；单独表达含义时传 `label`，旁边已有名称时省略。颜色来自 SVG 本身，以保证物种辨识度。

## 新增与使用

1. 将手绘 SVG 放进 `src/react-app/components/ui/icons/assets/`，采用正方形 viewBox、透明背景，检查小尺寸轮廓；禁用脚本、外链和 foreignObject。
2. 在同目录 `registry.ts` 显式导入并注册稳定名称，业务配置填写 `icon:名称`。名称按类别加前缀，例如 `beast-`。
3. 调用方只使用 `GameIcon`；不自行解析协议、不直接导入资源、不创建第二份注册表。删除或更名时同时检索配置引用。
4. 业务适配组件只负责从领域 ID 取图标值，例如共享的 `feature/beasts/BeastIcon.tsx`，渲染始终交给 `GameIcon`。

本轮迁移初始灵兽选择、兽栏列表及详情头像。七种保留动物 emoji；火翎鸦、雪翎鹤、月影貂、墨蛟、银翅螳螂、雷鹏、六目灵猿、冥灯蝶使用 SVG。技能图标和其他业务的既有图标留待各自迁移；新增或改动图标渲染应复用此入口。
