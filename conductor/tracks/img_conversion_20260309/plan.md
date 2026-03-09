# 实施计划：将所有的 next/image 替换为 img 标签

## 第一阶段：研究与准备 (Phase 1: Research & Preparation)
- [x] 任务 (Task): 识别所有使用 `next/image` 的组件
    - [x] 运行 `grep` 或 `rg` 找到所有 `from 'next/image'` 和 `from "next/image"` 的出现。
    - [x] 记录需要修改的文件列表。
- [x] 任务 (Task): 识别特殊属性（如 `fill`）的使用情况
    - [x] 列出所有使用 `<Image ... fill ... />` 的文件。
- [x] 任务 (Task): Conductor - User Manual Verification '第一阶段：研究与准备' (Protocol in workflow.md)
## 第二阶段：实施全局替换 (Phase 2: Implementation (Global Replace))
- [x] 任务 (Task): 批量替换导入和标签
    - [x] 使用搜索和替换工具删除 `import Image from 'next/image';`。
    - [x] 使用搜索和替换工具将 `<Image ... />` 转换为 `<img ... />`。
    - [x] 映射基本属性：`src`, `alt`, `width`, `height`, `className`, `style`。
- [x] 任务 (Task): 处理特殊情况（如 `fill` 属性）
    - [x] 将 `fill` 替换为适当的 CSS（例如：`object-fit: cover; width: 100%; height: 100%;`）。
- [x] 任务 (Task): Conductor - User Manual Verification '第二阶段：实施全局替换' (Protocol in workflow.md)

## 第三阶段：验证与校验 (Phase 3: Verification & Validation)
- [x] 任务 (Task): 构建项目
    - [x] 运行 `npm run build` 以确保没有 TypeScript 错误或编译问题。
- [x] 任务 (Task): Lint 和格式化
    - [x] 运行 `npm run lint` 和 `npm run format` 以确保代码一致性。
- [x] 任务 (Task): 视觉验证
    - [x] 手动检查关键页面，确保图像正确显示。
- [x] 任务 (Task): Conductor - User Manual Verification '第三阶段：验证与校验' (Protocol in workflow.md)

