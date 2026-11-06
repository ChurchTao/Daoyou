# 数字排版规范

统一使用 Tailwind 默认的 `font-mono`，不覆盖 `--font-mono`，不额外维护数字字体令牌、字体栈或语义类。

- 属性、资质、资源、表格等独立数值使用 `font-mono`。
- 物品堆叠数量使用 `font-mono font-semibold tracking-tight`，保留原字号、位置及阴影。
- 正文、技能描述、提示中的数字直接继承正文字体，不拆分或单独指定字体。
- 房间码、角色 ID、兑换码、代码等同样使用默认 `font-mono`。
- 字号、颜色、字重和布局由组件按用途控制。样式加在数值元素上，不覆盖整个页面或包含标签的段落。
- 玩家可见的概率、比例和进度使用阿拉伯数字紧接半角 `%`，例如 `20%`、`1.8%`。整值省略小数尾零。加算用 `+20%` 或 `-20%`，乘算可用 `×120%`，确保运算方式清楚。
- 动态文案用 `formatRatioPercent` 格式化比例（`0.2 → 20%`），用 `formatPercentValue` 格式化已经换算的百分数（`20 → 20%`）。两者由 `@daoyou/game-rules/presentation/numbers` 提供。

默认等宽字体由 Tailwind 提供跨平台回退，各操作系统的实际字体可以不同，不额外下载字体。

```tsx
<p>消耗 25 灵石，恢复 250 寿命。</p>
<dd className="font-mono text-sm">1,280</dd>
<span className="absolute top-1 left-1 font-mono font-semibold tracking-tight">×99</span>
```
