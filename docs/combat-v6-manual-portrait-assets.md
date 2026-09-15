# 功法打坐墨像素材记录

2026-09-11，使用内置 image_gen 生成，按用户授权用本地 Sharp 去白底、保留真实 alpha；未使用 Python。笔墨参考固定为 `.agents/skills/daoyou-ink-portraits/references/male-baseline.webp` 与 `female-baseline.webp`，不是身份或姿态编辑目标。

## 生产素材

- `public/assets/manuals/cultivator-male-meditation.webp`
- `public/assets/manuals/cultivator-female-meditation.webp`

两张均为 960×960 WebP，保留透明度，使用质量 90、alphaQuality 100；轮廓框内留边。像素 alpha 覆盖 0–255。按白底反合成得到墨迹透明度，清除接近白色的背景微纹，保留衣内留白与飞白。页面正常 opacity 显示，不使用 CSS 混合模式。纸色并排检查：盘坐轮廓完整，暖灰墨色一致，发髻与衣侧有浓墨支点，边缘无棋盘或白色矩形；脸部仍有简化眉眼，非纯减笔肖像。

## 男修提示词

Use case: stylized-concept. 为《万界道友》功法页面制作单个男修盘膝打坐的透明底写意墨像。两张输入图片仅为笔墨参考，不是编辑对象，不复制站姿。像古籍人物墨画，介于角色剪影与中国写意人物画之间。墨迹本身构成形体，几块暖灰宽笔墨面与少量长线概括结构，少量浓墨作支点，中淡墨、飞白与留白共同补全身形。笔触有干湿与行进方向，轮廓局部断开，末端散入留白。少量眉眼鼻墨笔提示神态，不精修肖像，不画封闭脸框再抹去五官。不画白衣材质立绘、不刻画复杂衣褶或写实光照。匿名年轻成年男修，简洁束发髻，近正面头身同向，闭目入定，双手自然上下叠放腹前，宽松朴素长袍覆盖盘坐双腿，盘膝形态清楚，双膝左右形成稳定三角重心，完整头顶到衣摆均在框内。衣袍以宽笔淡墨概括，非大片纯黑。无风吹长发、飘带、武器、首饰。方形构图，主体占画面高度85%、宽度80%，居中，供页面左侧显示。真实透明alpha背景，仅角色墨迹，无纸张、棋盘纹、地面、投影、光环、背景光、文字、签名、印章、水印。颜色只用暖灰墨色。输出一张PNG透明立绘。

初稿与一次透明修正均输出了烘焙棋盘，未接入项目。随后通过图像工具改为白底，再按用户授权做本地去底，最终修正词：

Edit only the background of the attached seated male ink painting: replace ALL checkerboard with a perfectly plain pure white background, with no texture, no gradient, no grid. Keep the character's warm gray brushwork, pose, face and silhouette intact. Add a small plain white margin so full head and knees and hem sit safely inside the square canvas. Do not draw any checkerboard anywhere. Production ink asset for later local alpha processing.

## 女修提示词

Use case: stylized-concept. 为《万界道友》功法页生成单个女修盘膝入定墨像。输入两张是固定笔墨参考，不是编辑目标，不复制站姿。古籍中国写意人物画，墨迹构形，几块暖灰宽笔墨面、少量长线、少量浓墨支点，中淡墨与飞白留白完成形体。用很少衣褶，保留干笔断续的行进方向，不是写实白衣立绘。匿名年轻成年女修，朴素束发髻，没有珠宝，闭目、近正面头身同向，双手自然上下叠于腹前，宽松朴素袍覆盖盘坐双腿，左右双膝形成稳定三角形，完整头髻到衣摆都在框内。面部仅少量笔触提示神态，不做空白面具。不增加飘带、彩色光效、背景和地面。方形构图，主体高度85%、宽度80%，居中，适合游戏页面左侧展示，和男修使用相同笔墨浓淡与构图。背景要求：纯净无纹理白色背景（不要绘制棋盘格，不要纸纹，不要阴影，不要渐变），只有完整独立人物，没有文字、印章、水印。仅暖灰墨色，无青色金色。

