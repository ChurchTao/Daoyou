# 灵兽头像生成记录

美术设计统一遵循 [写意墨像](../.agents/skills/daoyou-ink-portraits/SKILL.md)，导出与接入遵循其 [素材交付要求](../.agents/skills/daoyou-ink-portraits/references/beast-avatar-delivery.md)。本文件仅记录当前采用的写意墨像素材。

## 墨蛟（2026-09-18）

用户选定新水墨首稿并授权接入，采用 `exec-50cc0113-6630-4ebb-a32f-1fbfdb7b7b41.png`。首稿由内置 imagegen 生成，仅以 `.agents/skills/daoyou-ink-portraits/references/male-baseline.webp` 和 `female-baseline.webp` 为笔墨参考。

构思为盘身蓄势、低首侧顾的暗河墨蛟；暖灰宽笔、浓淡墨面与飞白构形，颈侧和尾鳍少量灰青彩墨。按用户选稿保留角、颈须、姿态和笔触，不再修改造型。生成提示的核心为：

```text
墨迹本身构成形体，几块暖灰宽笔墨面与少量长线概括躯体，少量浓墨作结构支点，中淡墨、飞白与留白补全形体；不逐片勾鳞，不用写实体积光。盘身蓄势、低首侧顾，闭口警觉，头与前颈为主视觉；以角、狭长吻部、颈须和尾鳍表现暗河蛟类。仅在颈侧和尾鳍融入少量低饱和灰青彩墨。独立真实透明底，无背景、光效、文字、印章。人物基准只作笔墨参考，不复制人物造型。
```

原图 1254×1254，Lanczos 等比缩小为 256×256，WebP 质量 90，保留 alpha，文件 35672 字节。覆盖 `public/assets/icons/beast-ink-jiao.webp`，沿用 `icon:beast-ink-jiao` 注册，不修改 UI、物种或个体数据。
