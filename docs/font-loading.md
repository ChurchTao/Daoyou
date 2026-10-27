# 客户端字体加载

游戏继续使用霞鹜文楷 Lite 正文和马善政标题，独立数值仍使用 Tailwind 默认 `font-mono`，不下载数字字体。

## 构建与字形覆盖

- 原始 TTF 位于 `apps/web/src/assets/fonts/`，由 `vite-plugin-font` 转为带内容哈希的 WOFF2，不再通过 `public` 发布完整 TTF。许可证保留在 `apps/web/public/assets/fonts/`。
- `apps/web/src/lib/fonts.ts` 先引入全字库分包，再引入扫描 `apps/web/src/**/*.{ts,tsx}` 得到的界面子集。后者覆盖相同字形范围，减少固定界面的请求数；聊天、玩家名和生成内容仍可按需加载全字库的其他分包。
- 不可删除全字库引入，也不可颠倒上述 CSS 注册顺序。只扫描源码无法覆盖动态文字。
- 分包保留 `font-display: swap`，并使用工具生成的本地字体度量回退。自动语言分组遗漏的原字库符号通过 `whiteList` 补入界面子集。
- 字体源文件或分包配置变化后，清理 `apps/web/node_modules/.vite/` 再构建；上游全字库缓存不检查源文件内容和配置变化。

## 彩色表情

图标和正文不用同一套字体。`GameIcon` 使用 `--font-emoji`：先用 Segoe UI Emoji、Apple Color Emoji、Noto Color Emoji，系统字库没有该字形时才用 Daoyou Emoji。正文和标题仍先用霞鹜文楷或马善政，系统表情字体排在中文度量回退之前。太极等文楷里已有的符号继续由文楷绘制。

- `apps/web/src/assets/fonts/DaoyouEmoji.woff2` 是去掉区域旗帜后的整套 Noto Color Emoji COLRv1，约 1.3MB。界面新增一个这份字库里已有的表情时，不用重新生成字体。许可证在 `apps/web/public/assets/fonts/OFL-NotoColorEmoji.txt`。
- `@font-face` 使用 `tech(color-COLRv1)`。不认识该格式的浏览器会跳过它，图标改用系统表情。
- 写在正文、底栏和句子里的表情不走这份字体，仍看系统字库。Windows 10 上，这类文字里的新表情仍可能空白；要稳定显示，把该字符交给 `GameIcon`。
- 地图 Canvas 继续使用不含表情字体的 `bodyFontStack`。
- 这份 woff2 不进入 `vite-plugin-font`。样式引用后由 Vite 加上内容哈希。只有更换上游 Noto 表情字库时，才运行 `apps/web/scripts/subset-emoji-font.py`。

## 开发和部署

正常使用已有的 `pnpm run dev`、`pnpm run build:client`。首次运行时 Vite 配置补装固定版本 `7.6.8` 的字体转换原生库，需要能访问 GitHub Releases；普通部署不需要 Python。

pnpm 禁用依赖安装脚本，因此原生库安装显式放在 Vite 配置中。`pnpm-workspace.yaml` 将 `cn-font-split` 的 Koffi 依赖固定为 `2.16.3`，避免旧版 `2.10` 在 Node 24 完成转换后退出异常。

## 缓存与 Canvas

- Cloudflare `_headers` 和根目录 `edgeone.json` 均为带哈希的 WOFF2 配置一年 `immutable` 缓存。
- Service Worker 将这些字体纳入有容量限制的构建资源 `CacheFirst` 缓存；不将全字库加入安装预缓存。
- 地图通过同一字体族和回退栈绘制 Canvas 标签。初始化时显式传入所有地图标签文字给 `document.fonts.load`，包括地区切换后会用到的标签；不以默认空格判断中文字体已就绪。

## 验收

运行 lint、typecheck 和客户端构建，核对所有输出 WOFF2 的 cmap 并集覆盖各自原 TTF 的 cmap。浏览器验证冷启动、动态补字、地图切换、移动端及 Service Worker 重复访问；不新增字体单元测试或一次性仓库验收脚本。
