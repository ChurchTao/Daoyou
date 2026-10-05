# 五种原创灵兽立绘补齐

2026-10-05。用户授权补齐此前仅有emoji的五种立绘，同时接入游戏和官网。均为项目原创，以当前物种描述和首批设计基准为身份依据，不虚构古籍出处。使用内置 image_gen，固定男女修士只作笔墨尺度、浓淡和飞白参考。

| 物种 / 稳定ID后缀 | 采用稿 | 形神与彩墨 |
| --- | --- | --- |
| 烛尾狐 / `spirit-fox` | v1 | 银灰小狐蹲坐，单尾绕到身前，侧首观察朱红赭金烛芯状尾尖；温和机敏 |
| 钢背猪 / `rock-boar` | v1 | 矮壮高肩、四蹄低首侧转；钢蓝灰活体硬皮从颈后连续覆盖到臀部 |
| 精灵狼 / `wind-wolf` | v1 | 灰银狼身窄腰低肩伏步，耳尖与下扫尾缘淡青，表现潜猎警觉 |
| 双尾蝎 / `red-tail-scorpion` | v2 | 沙褐钳身、四对步足，腹后两条独立暗红节尾分扬，各一毒刺 |
| 抱月熊 / `stoneback-bear` | v2 | 深褐宽笔长毛、四掌坐倚，前掌环拢浅金圆形胸腹毛色斑，侧首半醒 |

烛尾狐仅借用户像素板九尾狐的灰白与朱红色彩对照，保持单尾；其余四种没有直接对应，按已确认设定用色，不强套高阶异兽结构。双尾蝎v1少一对步足，未采用，v2补足八足。抱月熊v1金斑过长，v2定向收短成自然圆斑，不持月球或器物。未用程序补画、改色或伪造透明。

采用源稿、实际提示词、编辑词、生成路径与验证记录保存在 `output/imagegen/remaining-five-redesign/`，最终导出溯源为 `exports.json`。前三种原稿1254×1254，后两种1024×1536，均RGBA透明且源四边无alpha≥4墨迹。

游戏素材为 `apps/web/public/assets/icons/beast-{ID后缀}.webp`，256×256透明WebP。alpha≥4定位外边界后等比贴满、居中，质量90、alpha质量100；在统一registry注册，由已有BeastIcon链路读取。物种配置只修改5个icon，名称、ID、描述、开放境界、数值、技能及生成规则均未变。

官网新增 `public/assets/beasts/{ID后缀}.webp` 与 `*-thumb.webp`，高清来自原稿裁区且不放大，缩略图480×480；更新 `src/data/beast-art.json`。保留原29对图片及全部公开slug，补齐后34种均有高清立绘。

检查纸色／深底与游戏小尺寸静态效果、透明通道、路径、尺寸与SHA；官网HD内部alpha与源裁区逐像素一致。游戏检查 `pnpm run lint`、`pnpm run build:client`、已有物种包测试 `pnpm exec vitest run packages/game-rules/src/beasts/pack.test.ts`（37项通过）；官网检查 `npm run check`、`npm run build`、新增五种的列表／详情／高清加载；两仓检查 `git diff --check`。

未新增测试，未运行完整战斗测试、API构建或Lighthouse。遵照用户偏好，不开启游戏网页验收，游戏内效果由用户亲自验收。未部署。
